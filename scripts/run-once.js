import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { AutonomousAgent } from "../src/agent/autonomousAgent.js";
import { StateStore } from "../src/agent/stateStore.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadConfig(cwd);
const store = new StateStore(config.paths);
await store.init();

const agent = new AutonomousAgent(config, store);
const result = await agent.runOnce({ source: "cli" });
console.log(JSON.stringify(result, null, 2));
