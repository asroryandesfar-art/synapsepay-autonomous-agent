import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { StateStore } from "../src/agent/stateStore.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadConfig(cwd);

await rm(config.paths.stateFile, { force: true });
await rm(config.paths.eventsFile, { force: true });
await rm(config.paths.reportsDir, { recursive: true, force: true });

const store = new StateStore(config.paths);
await store.init();
console.log(JSON.stringify({ reset: true, dataDir: config.paths.dataDir }, null, 2));
