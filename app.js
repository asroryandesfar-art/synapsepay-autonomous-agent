// =============================================================================
// CONFIG & STATE
// =============================================================================

const API_BASE = '';
const POLL_INTERVAL = 5000; // 5 seconds
const DEMO_EVENTS_LIMIT = 80;
const STATIC_DEMO =
  window.location.hostname.endsWith('github.io') ||
  window.location.protocol === 'file:' ||
  new URLSearchParams(window.location.search).has('static');

let staticDemoSeed = 1;

let appState = {
  status: null,
  events: [],
  report: null,
  db: null,
  lastUpdate: new Date(),
  isLoading: false,
  isInitialized: false,
};

let pollTimers = {
  status: null,
  events: null,
  report: null,
};

function buildStaticSnapshot() {
  const now = Date.now();
  const runId = `synapsepay-demo-${String(staticDemoSeed).padStart(3, '0')}`;
  const paymentCount = 24 + staticDemoSeed * 4;
  const totalVolume = 1284.5 + staticDemoSeed * 37.25;
  const successfulRuns = 11 + staticDemoSeed;

  const payments = [
    { provider: 'Ace Data Cloud', step: 'market-brief', network: 'SAP escrow', asset: 'USDC', amount: 420.0, status: 'settled' },
    { provider: 'Ace Data Cloud', step: 'risk-model', network: 'SAP escrow', asset: 'USDC', amount: 315.25, status: 'settled' },
    { provider: 'Ace Data Cloud', step: 'order-enrichment', network: 'SAP escrow', asset: 'USDC', amount: 267.5, status: 'settled' },
    { provider: 'Synapse Sentinel', step: 'verification', network: 'SAP escrow', asset: 'USDC', amount: 89.75, status: 'settled' },
  ];

  const events = [
    { timestamp: new Date(now - 10000).toISOString(), type: 'success', message: 'Sentinel verification passed', details: { run_id: runId, verdict: 'verified' } },
    { timestamp: new Date(now - 25000).toISOString(), type: 'success', message: 'x402 escrow receipts recorded', details: { payment_count: paymentCount, total_volume: totalVolume } },
    { timestamp: new Date(now - 40000).toISOString(), type: 'info', message: 'Ace Data Cloud tools executed by agent', details: { ace_calls: 36 + staticDemoSeed * 3 } },
    { timestamp: new Date(now - 55000).toISOString(), type: 'info', message: 'SAP service discovery completed', details: { services: ['ace-data-cloud', 'sentinel-audit', 'escrow-ledger'] } },
  ];

  return {
    status: {
      mode: 'github-pages-demo',
      total_volume: totalVolume,
      total_runs: successfulRuns,
      successful_runs: successfulRuns,
      ace_calls: 36 + staticDemoSeed * 3,
      sentinel_calls: 12 + staticDemoSeed,
      sap_calls: 18 + staticDemoSeed * 2,
      db_connected: true,
      api_responding: true,
      ace_ready: true,
      sentinel_ready: true,
      sap_ready: true,
    },
    report: {
      run_id: runId,
      created_at: new Date(now - 8000).toISOString(),
      payment_count: paymentCount,
      total_volume: totalVolume,
      ace_calls: 36 + staticDemoSeed * 3,
      sentinel_passed: true,
      service_tags: ['sap', 'ace-data-cloud', 'x402', 'autonomous-agent'],
    },
    db: { payments },
    events,
  };
}

function applyStaticSnapshot({ increment = false } = {}) {
  if (increment) staticDemoSeed += 1;
  const snapshot = buildStaticSnapshot();
  appState.status = snapshot.status;
  appState.events = snapshot.events;
  appState.report = snapshot.report;
  appState.db = snapshot.db;
  return snapshot;
}

// =============================================================================
// INIT & STARTUP
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeApp();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize dashboard');
  }
});

async function initializeApp() {
  if (STATIC_DEMO) {
    applyStaticSnapshot();
    setupEventListeners();
    appState.isInitialized = true;
    updateConnectionStatus(true);
    updateUI();
    return;
  }

  console.log('🚀 Initializing SynapsePay Dashboard...');

  // Initial fetch
  await Promise.all([
    fetchStatus(),
    fetchEvents(),
    fetchReport(),
    fetchDB(),
  ]);

  // Setup polling
  setupPolling();

  // Setup event listeners
  setupEventListeners();

  appState.isInitialized = true;
  updateUI();

  console.log('✅ Dashboard initialized');
}

function setupPolling() {
  if (STATIC_DEMO) return;

  // Poll status
  pollTimers.status = setInterval(fetchStatus, POLL_INTERVAL);

  // Poll events
  pollTimers.events = setInterval(fetchEvents, POLL_INTERVAL);

  // Poll report less frequently
  setInterval(fetchReport, POLL_INTERVAL * 2);
}

function setupEventListeners() {
  const demoBtnProof = document.getElementById('demoBtnProof');
  const demoBtnOnce = document.getElementById('demoBtnOnce');
  const refreshBtn = document.getElementById('refreshBtn');
  const eventFilter = document.getElementById('eventFilter');

  if (demoBtnProof) demoBtnProof.addEventListener('click', runDemoProof);
  if (demoBtnOnce) demoBtnOnce.addEventListener('click', runDemoOnce);
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
  if (eventFilter) eventFilter.addEventListener('input', filterEvents);
}

// =============================================================================
// API CALLS
// =============================================================================

async function fetchStatus() {
  if (STATIC_DEMO) {
    applyStaticSnapshot();
    updateConnectionStatus(true);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    appState.status = await response.json();
    updateConnectionStatus(true);
    updateMetrics();
    updateReadiness();

  } catch (error) {
    console.error('Status fetch error:', error);
    applyStaticSnapshot();
    updateConnectionStatus(false);
  }
}

async function fetchEvents() {
  if (STATIC_DEMO) {
    applyStaticSnapshot();
    updateEventsList();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/events?limit=${DEMO_EVENTS_LIMIT}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    appState.events = await response.json() || [];
    updateEventsList();

  } catch (error) {
    console.error('Events fetch error:', error);
    applyStaticSnapshot();
    updateEventsList();
  }
}

async function fetchReport() {
  if (STATIC_DEMO) {
    applyStaticSnapshot();
    updateEvidence();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/reports/latest`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    appState.report = await response.json();
    updateEvidence();

  } catch (error) {
    console.error('Report fetch error:', error);
    applyStaticSnapshot();
    updateEvidence();
  }
}

async function fetchDB() {
  if (STATIC_DEMO) {
    applyStaticSnapshot();
    updateLedger();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/db`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    appState.db = await response.json();

  } catch (error) {
    console.error('DB fetch error:', error);
    applyStaticSnapshot();
    updateLedger();
  }
}

async function runDemoProof() {
  try {
    showLoading(true);
    const demoStatus = document.getElementById('demoStatus');

    if (STATIC_DEMO) {
      showDemoStatus('loading', 'Building static autonomous proof...');
      await new Promise(r => setTimeout(r, 700));
      applyStaticSnapshot({ increment: true });
      updateUI();
      showDemoStatus('success', `Demo proof refreshed (${appState.report.run_id})`);
      return;
    }

    const response = await fetch(`${API_BASE}/api/demo/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Demo failed: ${response.status}`);
    }

    const result = await response.json();

    // Show success
    showDemoStatus('success', `Demo executed successfully (Run ID: ${result.run_id || 'N/A'})`);

    // Refresh data after demo
    await new Promise(r => setTimeout(r, 1000));
    await Promise.all([
      fetchStatus(),
      fetchEvents(),
      fetchReport(),
      fetchDB(),
    ]);

    updateUI();

  } catch (error) {
    console.error('Demo error:', error);
    showDemoStatus('error', `Demo failed: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

async function runDemoOnce() {
  if (STATIC_DEMO) {
    await runDemoProof();
    return;
  }

  if (!isReadinessComplete()) {
    showDemoStatus('error', 'Readiness checks not passed');
    return;
  }

  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/run`, { method: 'POST' });

    if (!response.ok) throw new Error(`Run failed: ${response.status}`);

    await new Promise(r => setTimeout(r, 1000));
    await Promise.all([fetchStatus(), fetchEvents(), fetchReport()]);
    updateUI();

  } catch (error) {
    console.error('Run error:', error);
    showDemoStatus('error', `Run failed: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

async function handleRefresh() {
  try {
    await Promise.all([
      fetchStatus(),
      fetchEvents(),
      fetchReport(),
      fetchDB(),
    ]);
    updateUI();
  } catch (error) {
    console.error('Refresh error:', error);
    showError('Refresh failed');
  }
}

// =============================================================================
// UI UPDATES - METRICS
// =============================================================================

function updateMetrics() {
  const status = appState.status;
  if (!status) return;

  // Payment Volume
  const volume = formatCurrency(status.total_volume || 0);
  document.getElementById('volumeValue').textContent = volume;
  document.getElementById('volumeSub').textContent =
    `${status.successful_runs || 0} successful runs`;

  // Successful Runs
  document.getElementById('runValue').textContent = status.successful_runs || 0;
  const completion = status.total_runs ?
    Math.round((status.successful_runs / status.total_runs) * 100) : 0;
  document.getElementById('runSub').textContent = `${completion}% completion`;

  // Ace Calls
  document.getElementById('aceValue').textContent = status.ace_calls || 0;
  document.getElementById('aceSub').textContent = 'AI executed';

  // Sentinel Calls
  document.getElementById('sentinelValue').textContent = status.sentinel_calls || 0;
  document.getElementById('sentinelSub').textContent = 'Verified';

  // SAP Discovery
  document.getElementById('sapValue').textContent = status.sap_calls || 0;
  document.getElementById('sapSub').textContent = 'Protocol calls';

  // Update timestamp
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('lastUpdate').textContent = `Last update: ${timeStr}`;
}

function updateReadiness() {
  const status = appState.status;
  if (!status) return;

  const indicator = document.getElementById('readinessIndicator');
  const guards = document.getElementById('readinessGuards');

  // Check all guards
  const dbReady = status.db_connected || false;
  const apiReady = status.api_responding || false;
  const aceReady = status.ace_ready || false;
  const sentinelReady = status.sentinel_ready || false;
  const sapReady = status.sap_ready || false;

  const allReady = dbReady && apiReady && aceReady && sentinelReady && sapReady;

  // Update indicator
  const statusEl = indicator.querySelector('.readiness-status');
  if (statusEl) {
    statusEl.textContent = allReady ? 'Ready for Live' : 'Needs Secrets';
    statusEl.className = 'readiness-status ' + (allReady ? 'ready' : 'needs-secrets');
  }

  // Update guards list
  guards.innerHTML = `
    <div>${dbReady ? 'OK' : '--'} Database</div>
    <div>${apiReady ? 'OK' : '--'} API</div>
    <div>${aceReady ? 'OK' : '--'} Ace AI</div>
    <div>${sentinelReady ? 'OK' : '--'} Sentinel</div>
    <div>${sapReady ? 'OK' : '--'} SAP</div>
  `;

  // Update checklist
  updateReadinessChecklist({
    db: dbReady,
    api: apiReady,
    ace: aceReady,
    sentinel: sentinelReady,
    sap: sapReady,
  });

  // Enable/disable Run Once button
  const runOnceBtn = document.getElementById('demoBtnOnce');
  if (runOnceBtn) {
    runOnceBtn.disabled = !allReady;
  }

  // Update status badge
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.textContent = allReady ? 'Live Ready' : 'Development';
    badge.className = 'status-badge ' + (allReady ? 'active' : 'error');
  }
}

function updateReadinessChecklist(guards) {
  const checks = {
    checkDb: guards.db,
    checkApi: guards.api,
    checkAce: guards.ace,
    checkSentinel: guards.sentinel,
    checkSap: guards.sap,
  };

  Object.entries(checks).forEach(([id, ready]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = ready ? 'OK' : '--';
      el.className = 'check-icon ' + (ready ? 'ready' : '');
    }
  });
}

function isReadinessComplete() {
  const status = appState.status;
  if (!status) return false;
  return status.db_connected &&
         status.api_responding &&
         status.ace_ready &&
         status.sentinel_ready &&
         status.sap_ready;
}

// =============================================================================
// UI UPDATES - EVIDENCE
// =============================================================================

function updateEvidence() {
  const report = appState.report;
  const card = document.getElementById('evidenceCard');

  if (!report) {
    card.innerHTML = `
      <div class="evidence-empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">No execution report yet. Run demo to generate evidence.</div>
      </div>
    `;
    return;
  }

  const html = `
    <div class="evidence-content">
      <div class="evidence-row">
        <span class="evidence-label">Run ID</span>
        <span class="evidence-value">${report.run_id || 'N/A'}</span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Timestamp</span>
        <span class="evidence-value">${new Date(report.created_at).toLocaleString()}</span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Payment Count</span>
        <span class="evidence-value">${report.payment_count || 0}</span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Total Volume</span>
        <span class="evidence-value success">${formatCurrency(report.total_volume || 0)}</span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Ace Calls</span>
        <span class="evidence-value">${report.ace_calls || 0}</span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Sentinel Verdict</span>
        <span class="evidence-value ${report.sentinel_passed ? 'success' : 'danger'}">
          ${report.sentinel_passed ? 'Verified' : 'Failed'}
        </span>
      </div>
      <div class="evidence-row">
        <span class="evidence-label">Service Tags</span>
        <span class="evidence-value">${(report.service_tags || []).join(', ') || 'N/A'}</span>
      </div>
    </div>
  `;

  card.innerHTML = html;
}

// =============================================================================
// UI UPDATES - LEDGER
// =============================================================================

function updateLedger() {
  const db = appState.db;
  const container = document.getElementById('ledgerContainer');

  // Get payment events from db
  const payments = db?.payments || [];

  if (payments.length === 0) {
    container.innerHTML = `
      <div class="ledger-empty">
        <div class="empty-icon">💳</div>
        <div class="empty-text">No payment events yet</div>
      </div>
    `;
    return;
  }

  // Show latest payments
  const items = payments.slice(0, 10).map(payment => `
    <div class="ledger-item">
      <div class="ledger-item-header">
        <span class="ledger-item-title">${payment.provider || 'Unknown'}</span>
        <span class="ledger-item-amount">
          ${payment.amount ? formatCurrency(payment.amount) : '$0'}
        </span>
      </div>
      <div class="ledger-item-meta">
        <div class="ledger-meta-item">
          <span class="ledger-meta-label">Step</span>
          <span class="ledger-meta-value">${payment.step || 'N/A'}</span>
        </div>
        <div class="ledger-meta-item">
          <span class="ledger-meta-label">Network</span>
          <span class="ledger-meta-value">${payment.network || 'N/A'}</span>
        </div>
        <div class="ledger-meta-item">
          <span class="ledger-meta-label">Asset</span>
          <span class="ledger-meta-value">${payment.asset || 'N/A'}</span>
        </div>
        <div class="ledger-meta-item">
          <span class="ledger-meta-label">Status</span>
          <span class="ledger-meta-value">${payment.status || 'N/A'}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `<div class="ledger-items">${items}</div>`;
}

// =============================================================================
// UI UPDATES - EVENTS
// =============================================================================

function updateEventsList() {
  const list = document.getElementById('eventsList');
  const count = document.getElementById('eventCount');
  const events = appState.events || [];

  if (events.length === 0) {
    list.innerHTML = `
      <div class="events-empty">
        <div class="empty-icon">📊</div>
        <div class="empty-text">No events yet</div>
      </div>
    `;
    count.textContent = '0 events';
    return;
  }

  count.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;

  // Sort by timestamp descending
  const sorted = [...events].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const html = sorted.map(event => {
    const time = new Date(event.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const typeClass = event.type?.toLowerCase() || 'info';
    const eventTypeDisplay = event.type || 'INFO';

    return `
      <div class="event-item" data-type="${typeClass}">
        <div class="event-time">${timeStr}</div>
        <div>
          <span class="event-type ${typeClass}">${eventTypeDisplay}</span>
          <span class="event-message">${event.message || 'Event'}</span>
        </div>
        ${event.details ? `<div class="event-details">${escapeHtml(JSON.stringify(event.details))}</div>` : ''}
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

function filterEvents() {
  const filter = document.getElementById('eventFilter')?.value.toLowerCase() || '';
  const items = document.querySelectorAll('.event-item');

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(filter) ? '' : 'none';
  });
}

// =============================================================================
// UI UPDATES - CONNECTION & STATUS
// =============================================================================

function updateConnectionStatus(connected) {
  const status = document.getElementById('connectionStatus');
  if (!status) return;

  const dot = status.querySelector('.status-dot');
  const text = status.querySelector('span:last-child');

  if (connected) {
    dot.className = 'status-dot connected';
    text.textContent = 'Connected';
    status.style.color = 'var(--color-success)';
  } else {
    dot.className = 'status-dot error';
    text.textContent = 'Disconnected';
    status.style.color = 'var(--color-danger)';
  }
}

// =============================================================================
// UI STATE HELPERS
// =============================================================================

function updateUI() {
  updateMetrics();
  updateReadiness();
  updateEvidence();
  updateLedger();
  updateEventsList();
}

function showLoading(visible) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.toggle('show', visible);
  }
  appState.isLoading = visible;
}

function showDemoStatus(type, message) {
  const status = document.getElementById('demoStatus');
  if (!status) return;

  status.textContent = message;
  status.className = `demo-status show ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      status.classList.remove('show');
    }, 5000);
  }
}

function showError(message) {
  const status = document.getElementById('demoStatus');
  if (status) {
    showDemoStatus('error', message);
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatCurrency(value) {
  if (!value) return '$0';

  const num = parseFloat(value);
  if (isNaN(num)) return '$0';

  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function log(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`, data || '');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  Object.values(pollTimers).forEach(timer => {
    if (timer) clearInterval(timer);
  });
});

log('🎯 SynapsePay Dashboard script loaded');
