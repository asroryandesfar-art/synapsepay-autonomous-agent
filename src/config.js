import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULTS = {
  PORT: "8787",
  AUTONOMY_MODE: "demo",
  AUTO_START: "true",
  RUN_ON_BOOT: "true",
  RUN_INTERVAL_MS: "300000",
  MAX_USD_PER_RUN: "0.25",
  MAX_USD_PER_DAY: "5",
  MIN_TOOL_CONFIDENCE: "0.64",
  ALLOW_ONCHAIN_MUTATIONS: "false",
  SAP_SENTINEL_WALLET: "Ccr2yK3hLALU4p8oNRqrh4dGuvPJTth5KCLMio8cE1ph",
  SAP_X402_ENDPOINT: "http://127.0.0.1:8787/api/x402",
  ACE_BASE_URL: "https://platform.acedata.cloud"
};

export async function loadConfig(cwd = process.cwd()) {
  await loadDotEnv(path.join(cwd, ".env"));

  const workflow = await readJson(path.join(cwd, "config", "workflow.json"));
  const manifest = await readJson(path.join(cwd, "config", "agent.manifest.json"));
  const env = { ...DEFAULTS, ...process.env };
  const mode = normalizeMode(env.AUTONOMY_MODE);

  return {
    cwd,
    mode,
    port: toInt(env.PORT, 8787),
    autoStart: toBool(env.AUTO_START),
    runOnBoot: toBool(env.RUN_ON_BOOT),
    runIntervalMs: Math.max(30_000, toInt(env.RUN_INTERVAL_MS, 300_000)),
    allowOnchainMutations: toBool(env.ALLOW_ONCHAIN_MUTATIONS),
    policy: {
      maxUsdPerRun: toNumber(env.MAX_USD_PER_RUN, 0.25),
      maxUsdPerDay: toNumber(env.MAX_USD_PER_DAY, 5),
      minToolConfidence: toNumber(env.MIN_TOOL_CONFIDENCE, 0.64)
    },
    paths: {
      publicDir: path.join(cwd, "public"),
      dataDir: path.join(cwd, "data"),
      stateFile: path.join(cwd, "data", "state.json"),
      eventsFile: path.join(cwd, "data", "events.jsonl"),
      reportsDir: path.join(cwd, "data", "reports")
    },
    sap: {
      rpcUrl: env.SAP_RPC_URL,
      walletPath: env.SAP_WALLET_PATH ? path.resolve(cwd, env.SAP_WALLET_PATH) : "",
      agentWallet: env.SAP_AGENT_WALLET,
      sentinelWallet: env.SAP_SENTINEL_WALLET,
      x402Endpoint: env.SAP_X402_ENDPOINT
    },
    ace: {
      baseUrl: env.ACE_BASE_URL,
      platformToken: env.ACE_PLATFORM_TOKEN,
      orderId: env.ACE_X402_ORDER_ID,
      privateKey: env.ACE_X402_PRIVATE_KEY
    },
    signalSourceUrl: env.SIGNAL_SOURCE_URL,
    workflow,
    manifest: {
      ...manifest,
      x402Endpoint: env.SAP_X402_ENDPOINT || manifest.x402Endpoint
    }
  };
}

async function loadDotEnv(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

function normalizeMode(value) {
  const mode = String(value || "demo").toLowerCase();
  if (mode === "live" || mode === "demo") return mode;
  return "demo";
}

function toBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
