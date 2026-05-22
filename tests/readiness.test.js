import test from "node:test";
import assert from "node:assert/strict";
import { assertRunReady, evaluateReadiness } from "../src/readiness.js";

const baseConfig = {
  mode: "live",
  allowOnchainMutations: false,
  sap: {
    rpcUrl: "https://us-1-mainnet.oobeprotocol.ai/rpc?api_key=real",
    walletPath: "keys/agent.json",
    agentWallet: "EVGFEpRnLVsuVaz9qQNfnGGdxsZxoXdD2RUsndmKo2H5"
  },
  ace: {
    platformToken: "platform-v1-real",
    orderId: "order-real",
    privateKey: `0x${"1".repeat(64)}`
  }
};

test("readiness marks live guarded when credentials are present but on-chain mutations are off", () => {
  const readiness = evaluateReadiness(baseConfig);
  assert.equal(readiness.runReady, true);
  assert.equal(readiness.registerReady, false);
  assert.equal(readiness.status, "live-guarded");
});

test("readiness blocks placeholder private keys before live execution", () => {
  const config = {
    ...baseConfig,
    ace: {
      ...baseConfig.ace,
      privateKey: "0xYOUR_EVM_PRIVATE_KEY"
    }
  };
  const readiness = evaluateReadiness(config);
  assert.equal(readiness.runReady, false);
  assert.equal(readiness.missing.includes("ace_x402_private_key"), true);

  const assertion = assertRunReady(config);
  assert.equal(assertion.ok, false);
  assert.match(assertion.reason, /Live preflight blocked/);
});

test("demo mode is ready without live credentials", () => {
  const readiness = evaluateReadiness({
    ...baseConfig,
    mode: "demo",
    sap: {},
    ace: {}
  });
  assert.equal(readiness.runReady, true);
  assert.equal(readiness.status, "demo-ready");
});
