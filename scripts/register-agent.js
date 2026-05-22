import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { SapIntegration } from "../src/integrations/sapClient.js";
import { StateStore } from "../src/agent/stateStore.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadConfig(cwd);
const store = new StateStore(config.paths);
await store.init();

if (config.mode !== "live") {
  throw new Error("Set AUTONOMY_MODE=live before registering on SAP.");
}

const sap = new SapIntegration(config, store);
const receipt = await sap.registerAgent(config.manifest);
await store.appendEvent({
  level: receipt.skipped ? "warn" : "info",
  type: "sap.agent.register",
  receipt
});
console.log(JSON.stringify(receipt, null, 2));
