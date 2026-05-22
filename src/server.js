import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { AutonomousAgent } from "./agent/autonomousAgent.js";
import { StateStore } from "./agent/stateStore.js";
import { evaluateReadiness } from "./readiness.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadConfig(cwd);
const store = new StateStore(config.paths);
await store.init();
const agent = new AutonomousAgent(config, store);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(config.port, "127.0.0.1", async () => {
  await store.appendEvent({
    level: "info",
    type: "server.started",
    mode: config.mode,
    port: config.port
  });
  if (config.autoStart) {
    await agent.start();
  } else {
    await store.update((state) => {
      state.status = "idle";
      state.activeRunId = null;
      state.nextRunAt = null;
      return state;
    });
  }
  console.log(`Autonomous agent listening on http://127.0.0.1:${config.port}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/status") {
    const state = await store.readState();
    const readiness = evaluateReadiness(config);
    sendJson(res, 200, {
      mode: config.mode,
      autoStart: config.autoStart,
      runIntervalMs: config.runIntervalMs,
      policy: config.policy,
      readiness,
      database: await store.databaseStats(),
      api: apiSurface(),
      workflow: {
        name: config.workflow.name,
        requiredCapabilities: config.workflow.requiredCapabilities,
        aceServices: config.workflow.aceServices.map((service) => ({
          id: service.id,
          kind: service.kind,
          capability: service.capability,
          estimatedUsd: service.estimatedUsd
        }))
      },
      state
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/readiness") {
    sendJson(res, 200, evaluateReadiness(config));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      mode: config.mode,
      readiness: evaluateReadiness(config),
      ts: new Date().toISOString()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/manifest") {
    sendJson(res, 200, config.manifest);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    const limit = Number.parseInt(url.searchParams.get("limit") || "120", 10);
    sendJson(res, 200, { events: await store.listEvents(limit) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    const state = await store.readState();
    sendJson(res, 200, { runs: state.runs });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ledger") {
    const state = await store.readState();
    sendJson(res, 200, { ledger: state.ledger, metrics: state.metrics });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    const result = await agent.runOnce({ source: "manual" });
    sendJson(res, 202, { result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/demo/run") {
    const demoConfig = structuredClone(config);
    demoConfig.mode = "demo";
    demoConfig.autoStart = false;
    demoConfig.runOnBoot = false;
    demoConfig.allowOnchainMutations = false;
    const demoAgent = new AutonomousAgent(demoConfig, store);
    const result = await demoAgent.runOnce({ source: "demo-schedule" });
    sendJson(res, 202, { result, simulated: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start") {
    await agent.start();
    sendJson(res, 200, { ok: true, status: "scheduled" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/stop") {
    await agent.stop();
    sendJson(res, 200, { ok: true, status: "idle" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reports/latest") {
    sendJson(res, 200, { report: await store.readLatestReport() });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/reports/")) {
    const runId = decodeURIComponent(url.pathname.split("/").pop());
    sendJson(res, 200, await store.readReport(runId));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/db") {
    sendJson(res, 200, { ...(await store.databaseStats()), api: apiSurface() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/x402") {
    const body = await readBody(req);
    sendJson(res, 200, {
      ok: true,
      received: body,
      note: "Local endpoint for SAP x402 callbacks/demo receipts."
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function apiSurface() {
  return [
    "GET /api/status",
    "GET /api/health",
    "GET /api/readiness",
    "GET /api/events",
    "GET /api/runs",
    "GET /api/ledger",
    "GET /api/reports/latest",
    "GET /api/manifest",
    "GET /api/db",
    "POST /api/run",
    "POST /api/demo/run",
    "POST /api/start",
    "POST /api/stop",
    "POST /api/x402"
  ];
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(config.paths.publicDir, safePath));
  if (!filePath.startsWith(config.paths.publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    await readFile(filePath);
  } catch {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  res.writeHead(200, { "Content-Type": contentType(filePath) });
  createReadStream(filePath).pipe(res);
}

function sendJson(res, status, payload) {
  res.writeHead(status, corsHeaders({ "Content-Type": "application/json" }));
  res.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(res, status) {
  res.writeHead(status, corsHeaders());
  res.end();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function corsHeaders(headers = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    ...headers
  };
}
