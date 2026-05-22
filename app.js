const els = {
  status: document.querySelector("#status"),
  volume: document.querySelector("#volume"),
  aceCalls: document.querySelector("#aceCalls"),
  sentinelCalls: document.querySelector("#sentinelCalls"),
  workflow: document.querySelector("#workflow"),
  events: document.querySelector("#events"),
  runs: document.querySelector("#runs"),
  ledger: document.querySelector("#ledger"),
  mode: document.querySelector("#mode"),
  eventCount: document.querySelector("#eventCount"),
  runDemo: document.querySelector("#runDemo"),
  runNow: document.querySelector("#runNow"),
  toggleAgent: document.querySelector("#toggleAgent"),
  readiness: document.querySelector("#readiness"),
  readinessStatus: document.querySelector("#readinessStatus"),
  reportStatus: document.querySelector("#reportStatus"),
  reportSummary: document.querySelector("#reportSummary"),
  dbStatus: document.querySelector("#dbStatus"),
  dbSummary: document.querySelector("#dbSummary")
};

const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8787" : "";
let latestState = null;

async function refresh() {
  try {
    const [status, eventPayload, latestReport] = await Promise.all([
      fetchJson("/api/status"),
      fetchJson("/api/events?limit=80"),
      fetchJson("/api/reports/latest")
    ]);
    latestState = status.state;
    renderStatus(status);
    renderWorkflow(status.workflow);
    renderReport(latestReport.report);
    renderDatabase(status.database, status.api);
    renderRuns(status.state.runs || []);
    renderLedger(status.state.ledger || []);
    renderEvents(eventPayload.events || []);
    renderReadiness(status.readiness);
    updateControls(status);
  } catch (error) {
    renderOffline(error);
  }
}

function renderStatus(payload) {
  const metrics = payload.state.metrics;
  els.status.textContent = payload.state.status;
  els.volume.textContent = money(metrics.estimatedUsdVolume);
  els.aceCalls.textContent = metrics.aceServiceCalls;
  els.sentinelCalls.textContent = metrics.sentinelCalls;
  els.mode.textContent = payload.readiness?.status || payload.mode;
  els.toggleAgent.textContent = payload.state.status === "idle" ? "Start Auto" : "Pause";
}

function renderReadiness(readiness) {
  if (!readiness) {
    els.readinessStatus.textContent = "unknown";
    els.readiness.innerHTML = emptyOrRows([], () => "");
    return;
  }
  els.readinessStatus.textContent = readiness.status;
  els.readiness.innerHTML = readiness.checks
    .map(
      (item) => `
        <div class="readiness-row ${item.ok ? "ok" : "missing"}">
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.ok ? "Ready" : item.action)}</span>
          </div>
          <span class="status-dot" aria-label="${item.ok ? "Ready" : "Missing"}"></span>
        </div>
      `
    )
    .join("");
}

function renderReport(report) {
  if (!report) {
    els.reportStatus.textContent = "empty";
    els.reportSummary.innerHTML = `
      <div class="empty-copy">
        <strong>No report yet</strong>
        <span>Use Demo Proof for a safe simulated evidence run, or Run Once after live readiness is complete.</span>
      </div>
    `;
    return;
  }

  els.reportStatus.textContent = report.mode;
  const services = report.aceExecution?.distinctServices || [];
  els.reportSummary.innerHTML = `
    <div class="report-grid">
      <div><span>Run</span><strong>${escapeHtml(report.runId)}</strong></div>
      <div><span>Payments</span><strong>${report.paymentSummary?.events || 0}</strong></div>
      <div><span>Volume</span><strong>${money(report.paymentSummary?.estimatedUsd || 0)}</strong></div>
      <div><span>Sentinel</span><strong>${escapeHtml(report.sentinel?.verdict || "pending")}</strong></div>
    </div>
    <div class="service-list">${services.map((service) => `<span>${escapeHtml(service)}</span>`).join("")}</div>
  `;
}

function renderDatabase(database, api) {
  if (!database) return;
  els.dbStatus.textContent = database.engine;
  els.dbSummary.innerHTML = `
    <div class="db-row"><strong>State</strong><span>${formatBytes(database.stateBytes)}</span></div>
    <div class="db-row"><strong>Events</strong><span>${formatBytes(database.eventsBytes)}</span></div>
    <div class="db-row"><strong>Reports</strong><span>${database.reports}</span></div>
    <div class="db-row"><strong>API</strong><span>${api?.length || 0} endpoints</span></div>
    <div class="api-list">${(api || []).slice(0, 8).map((endpoint) => `<span>${escapeHtml(endpoint)}</span>`).join("")}</div>
  `;
}

function updateControls(payload) {
  const readiness = payload.readiness;
  const liveBlocked = payload.mode === "live" && readiness && !readiness.runReady;
  const autoBlocked = payload.mode === "live" && readiness && !readiness.autoStartReady;
  els.runNow.disabled = liveBlocked;
  els.runDemo.disabled = false;
  els.toggleAgent.disabled = autoBlocked && payload.state.status === "idle";
  els.runNow.title = liveBlocked ? "Live credentials are incomplete. See readiness panel." : "Run one workflow now.";
  els.toggleAgent.title =
    autoBlocked && payload.state.status === "idle"
      ? "Auto-run is blocked until live readiness is complete."
      : "Start or pause the autonomous schedule.";
}

function renderWorkflow(workflow) {
  els.workflow.innerHTML = "";
  for (const [index, service] of workflow.aceServices.entries()) {
    els.workflow.appendChild(
      stepRow(index + 1, service.id, `${service.kind} / ${service.capability}`, service.estimatedUsd)
    );
  }
  els.workflow.appendChild(stepRow(workflow.aceServices.length + 1, "sentinel-verification", "SAP Sentinel audit", 0.02));
  els.workflow.appendChild(stepRow(workflow.aceServices.length + 2, "settlement-proof", "x402 payment ledger", 0));
}

function stepRow(index, title, detail, cost) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div class="step-dot">${index}</div>
    <div class="step-main">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    <div class="cost">${money(cost)}</div>
  `;
  return li;
}

function renderRuns(runs) {
  els.runs.innerHTML = emptyOrRows(
    runs,
    (run) => `
      <div class="run-row">
        <div>
          <strong>${escapeHtml(run.runId)}</strong>
          <span>${escapeHtml(run.trigger)} / ${formatTime(run.startedAt)}</span>
        </div>
        <span class="tag ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
      </div>
    `
  );
}

function renderLedger(ledger) {
  const recent = [...ledger].reverse().slice(0, 18);
  els.ledger.innerHTML = emptyOrRows(
    recent,
    (item) => `
      <div class="ledger-row">
        <div>
          <strong>${escapeHtml(item.provider)} / ${escapeHtml(item.stepId)}</strong>
          <span>${escapeHtml(item.network)} ${escapeHtml(item.asset)} / ${formatTime(item.ts)}</span>
        </div>
        <span class="tag success">${money(item.usdAmount)}</span>
      </div>
    `
  );
}

function renderEvents(events) {
  els.eventCount.textContent = `${events.length} events`;
  els.events.innerHTML = emptyOrRows(
    [...events].reverse(),
    (event) => `
      <div class="event-row" data-level="${escapeHtml(event.level || "info")}">
        <strong>${escapeHtml(event.type)}</strong>
        <span>${formatTime(event.ts)}${event.runId ? ` / ${escapeHtml(event.runId)}` : ""}${event.message ? ` / ${escapeHtml(event.message)}` : ""}</span>
      </div>
    `
  );
}

els.runNow.addEventListener("click", async () => {
  els.runNow.disabled = true;
  try {
    await fetchJson("/api/run", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  }
});

els.runDemo.addEventListener("click", async () => {
  els.runDemo.disabled = true;
  try {
    await fetchJson("/api/demo/run", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  }
});

els.toggleAgent.addEventListener("click", async () => {
  const shouldStart = latestState?.status === "idle";
  try {
    await fetchJson(shouldStart ? "/api/start" : "/api/stop", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  }
});

async function fetchJson(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options);
  if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
  return response.json();
}

function renderOffline(error) {
  latestState = { status: "offline" };
  els.status.textContent = "offline";
  els.volume.textContent = "$0.00";
  els.aceCalls.textContent = "0";
  els.sentinelCalls.textContent = "0";
  els.mode.textContent = "api";
  els.readinessStatus.textContent = "offline";
  els.reportStatus.textContent = "offline";
  els.dbStatus.textContent = "offline";
  els.reportSummary.innerHTML = emptyPanel("No API connection");
  els.dbSummary.innerHTML = emptyPanel("No API connection");
  els.readiness.innerHTML = `
    <div class="readiness-row missing">
      <div>
        <strong>Local API</strong>
        <span>Start the server with npm.cmd start or node src/server.js.</span>
      </div>
      <span class="status-dot" aria-label="Missing"></span>
    </div>
  `;
  els.runNow.disabled = true;
  els.runDemo.disabled = true;
  els.toggleAgent.disabled = true;
  els.toggleAgent.textContent = "Resume";
  els.eventCount.textContent = "1 event";
  els.workflow.innerHTML = "";
  [
    ["SAP discovery", "Waiting for local API"],
    ["Ace execution", "Waiting for local API"],
    ["Sentinel audit", "Waiting for local API"],
    ["x402 ledger", "Waiting for local API"]
  ].forEach(([title, detail], index) => els.workflow.appendChild(stepRow(index + 1, title, detail, 0)));
  els.runs.innerHTML = emptyOrRows([], () => "");
  els.ledger.innerHTML = emptyOrRows([], () => "");
  els.events.innerHTML = `
    <div class="event-row" data-level="error">
      <strong>dashboard.api.offline</strong>
      <span>${escapeHtml(error.message)}</span>
    </div>
  `;
}

function emptyPanel(message) {
  return `<div class="empty-copy"><strong>${escapeHtml(message)}</strong><span>Waiting for localhost.</span></div>`;
}

function emptyOrRows(items, render) {
  if (!items.length) return `<div class="event-row"><strong>No records yet</strong><span>Waiting for the next autonomous run.</span></div>`;
  return items.map(render).join("");
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatTime(value) {
  if (!value) return "pending";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatBytes(value) {
  const number = Number(value || 0);
  if (number < 1024) return `${number} B`;
  return `${(number / 1024).toFixed(1)} KB`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refresh();
setInterval(() => {
  refresh();
}, 5000);
