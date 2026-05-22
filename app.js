const els = {
  status: document.querySelector("#status"),
  volume: document.querySelector("#volume"),
  paymentEvents: document.querySelector("#paymentEvents"),
  successfulRuns: document.querySelector("#successfulRuns"),
  lastRunId: document.querySelector("#lastRunId"),
  aceCalls: document.querySelector("#aceCalls"),
  sentinelCalls: document.querySelector("#sentinelCalls"),
  workflow: document.querySelector("#workflow"),
  workflowStatus: document.querySelector("#workflowStatus"),
  events: document.querySelector("#events"),
  runs: document.querySelector("#runs"),
  ledger: document.querySelector("#ledger"),
  ledgerCount: document.querySelector("#ledgerCount"),
  mode: document.querySelector("#mode"),
  eventCount: document.querySelector("#eventCount"),
  apiCount: document.querySelector("#apiCount"),
  runDemo: document.querySelector("#runDemo"),
  runNow: document.querySelector("#runNow"),
  toggleAgent: document.querySelector("#toggleAgent"),
  readiness: document.querySelector("#readiness"),
  readinessStatus: document.querySelector("#readinessStatus"),
  readinessBadge: document.querySelector("#readinessBadge"),
  reportStatus: document.querySelector("#reportStatus"),
  reportSummary: document.querySelector("#reportSummary"),
  dbStatus: document.querySelector("#dbStatus"),
  dbSummary: document.querySelector("#dbSummary")
};

const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8787" : "";
const buttonLabels = new Map();
let latestState = null;

for (const button of [els.runDemo, els.runNow, els.toggleAgent]) {
  buttonLabels.set(button, button.textContent);
}

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
  const metrics = payload.state.metrics || {};
  const readiness = payload.readiness;
  const latestRun = payload.state.runs?.[0];
  const apiSize = payload.api?.length || 0;

  els.status.textContent = payload.state.status;
  els.volume.textContent = money(metrics.estimatedUsdVolume);
  els.paymentEvents.textContent = `${metrics.paymentEvents || 0} payment events`;
  els.successfulRuns.textContent = metrics.successfulRuns || 0;
  els.lastRunId.textContent = latestRun ? latestRun.runId : "No run yet";
  els.aceCalls.textContent = metrics.aceServiceCalls || 0;
  els.sentinelCalls.textContent = metrics.sentinelCalls || 0;
  els.mode.textContent = readiness?.status || payload.mode;
  els.readinessBadge.textContent = readiness?.status || payload.mode;
  els.apiCount.textContent = `${apiSize} endpoints`;
  els.workflowStatus.textContent = readiness?.status || payload.mode;
  els.toggleAgent.textContent = payload.state.status === "idle" ? "Start Auto" : "Pause";
}

function renderReadiness(readiness) {
  if (!readiness) {
    els.readinessStatus.textContent = "unknown";
    els.readiness.innerHTML = emptyOrRows([], () => "");
    return;
  }

  const ready = readiness.checks.filter((item) => item.ok).length;
  els.readinessStatus.textContent = `${ready}/${readiness.checks.length} ready`;
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
  const scheduled = report.trigger?.scheduled ? "scheduled" : report.trigger?.source || "manual";
  els.reportSummary.innerHTML = `
    <div class="report-grid">
      <div><span>Run</span><strong>${escapeHtml(report.runId)}</strong></div>
      <div><span>Payments</span><strong>${report.paymentSummary?.events || 0}</strong></div>
      <div><span>Volume</span><strong>${money(report.paymentSummary?.estimatedUsd || 0)}</strong></div>
      <div><span>Sentinel</span><strong>${escapeHtml(report.sentinel?.verdict || "pending")}</strong></div>
    </div>
    <div class="proof-strip">
      <div class="proof-card"><span>Trigger</span><strong>${escapeHtml(scheduled)}</strong></div>
      <div class="proof-card"><span>SAP Tools</span><strong>${report.sapDiscovery?.toolsFound || 0}</strong></div>
      <div class="proof-card"><span>Ace Services</span><strong>${services.length}</strong></div>
      <div class="proof-card"><span>Networks</span><strong>${escapeHtml((report.paymentSummary?.networks || []).join(", ") || "pending")}</strong></div>
      <div class="proof-card"><span>Assets</span><strong>${escapeHtml((report.paymentSummary?.assets || []).join(", ") || "pending")}</strong></div>
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
    <div class="api-list">${(api || []).slice(0, 10).map((endpoint) => `<span>${escapeHtml(endpoint)}</span>`).join("")}</div>
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
  els.ledgerCount.textContent = `${ledger.length} events`;
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
  setBusy(els.runNow, true, "Running");
  try {
    await fetchJson("/api/run", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  } finally {
    setBusy(els.runNow, false);
  }
});

els.runDemo.addEventListener("click", async () => {
  setBusy(els.runDemo, true, "Building proof");
  try {
    await fetchJson("/api/demo/run", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  } finally {
    setBusy(els.runDemo, false);
  }
});

els.toggleAgent.addEventListener("click", async () => {
  const shouldStart = latestState?.status === "idle";
  setBusy(els.toggleAgent, true, shouldStart ? "Starting" : "Pausing");
  try {
    await fetchJson(shouldStart ? "/api/start" : "/api/stop", { method: "POST" });
    await refresh();
  } catch (error) {
    renderOffline(error);
  } finally {
    setBusy(els.toggleAgent, false);
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
  els.paymentEvents.textContent = "0 payment events";
  els.successfulRuns.textContent = "0";
  els.lastRunId.textContent = "No API connection";
  els.aceCalls.textContent = "0";
  els.sentinelCalls.textContent = "0";
  els.mode.textContent = "api";
  els.workflowStatus.textContent = "offline";
  els.readinessStatus.textContent = "offline";
  els.readinessBadge.textContent = "offline";
  els.apiCount.textContent = "0 endpoints";
  els.reportStatus.textContent = "offline";
  els.dbStatus.textContent = "offline";
  els.ledgerCount.textContent = "0 events";
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

function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) button.disabled = true;
  button.textContent = busy ? label : buttonLabels.get(button);
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
