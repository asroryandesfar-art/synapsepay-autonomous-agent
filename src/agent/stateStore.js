import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export class StateStore {
  constructor(paths) {
    this.paths = paths;
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(this.paths.dataDir, { recursive: true });
    await mkdir(this.paths.reportsDir, { recursive: true });
    const state = await this.readState();
    await this.writeState(mergeDefaults(defaultState(), state));
  }

  async readState() {
    try {
      const raw = await readFile(this.paths.stateFile, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") return defaultState();
      throw error;
    }
  }

  async update(mutator) {
    return this.enqueue(async () => {
      const current = await this.readState();
      const next = await mutator(structuredClone(current));
      await this.writeState(next);
      return next;
    });
  }

  async writeState(state) {
    const tmp = `${this.paths.stateFile}.tmp`;
    await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tmp, this.paths.stateFile);
  }

  async appendEvent(event) {
    const enriched = {
      ts: new Date().toISOString(),
      ...event
    };
    await appendFile(this.paths.eventsFile, `${JSON.stringify(enriched)}\n`, "utf8");
    await this.update((state) => {
      state.lastEvent = enriched;
      state.eventsSeen = (state.eventsSeen || 0) + 1;
      return state;
    });
    return enriched;
  }

  async listEvents(limit = 120) {
    try {
      const raw = await readFile(this.paths.eventsFile, "utf8");
      const rows = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      return rows.slice(Math.max(0, rows.length - limit));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async writeReport(runId, report) {
    const reportPath = path.join(this.paths.reportsDir, `${runId}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return reportPath;
  }

  async readReport(runId) {
    const reportPath = path.join(this.paths.reportsDir, `${runId}.json`);
    const raw = await readFile(reportPath, "utf8");
    return JSON.parse(raw);
  }

  async readLatestReport() {
    const state = await this.readState();
    const successful = state.runs.find((run) => run.status === "success");
    if (!successful) return null;
    return this.readReport(successful.runId);
  }

  async databaseStats() {
    const [state, events] = await Promise.all([this.safeStat(this.paths.stateFile), this.safeStat(this.paths.eventsFile)]);
    const reports = await this.countReports();
    return {
      engine: "json-file",
      stateBytes: state?.size || 0,
      eventsBytes: events?.size || 0,
      reports,
      paths: {
        state: this.paths.stateFile,
        events: this.paths.eventsFile,
        reports: this.paths.reportsDir
      }
    };
  }

  async safeStat(filePath) {
    try {
      return await stat(filePath);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async countReports() {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(this.paths.reportsDir);
      return files.filter((file) => file.endsWith(".json")).length;
    } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }
  }

  enqueue(operation) {
    const run = this.queue.then(operation, operation);
    this.queue = run.catch(() => {});
    return run;
  }
}

function mergeDefaults(defaults, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const merged = { ...defaults, ...value };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue) &&
      value[key] &&
      typeof value[key] === "object" &&
      !Array.isArray(value[key])
    ) {
      merged[key] = mergeDefaults(defaultValue, value[key]);
    }
  }
  return merged;
}

export function defaultState() {
  return {
    status: "idle",
    startedAt: null,
    lastRunAt: null,
    lastRunId: null,
    nextRunAt: null,
    activeRunId: null,
    runs: [],
    ledger: [],
    metrics: {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      blockedRuns: 0,
      autonomousRuns: 0,
      sapDiscoveries: 0,
      aceServiceCalls: 0,
      sentinelCalls: 0,
      paymentEvents: 0,
      estimatedUsdVolume: 0
    },
    eventsSeen: 0,
    lastEvent: null
  };
}
