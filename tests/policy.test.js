import test from "node:test";
import assert from "node:assert/strict";
import { PolicyEngine } from "../src/agent/policy.js";

test("PolicyEngine approves a plan inside cost and confidence limits", () => {
  const engine = new PolicyEngine({
    maxUsdPerRun: 0.25,
    maxUsdPerDay: 5,
    minToolConfidence: 0.64
  });

  const decision = engine.assessRun(
    {
      steps: [{ estimatedUsd: 0.04 }, { estimatedUsd: 0.03 }, { estimatedUsd: 0.02 }],
      selectedTools: [{ id: "sentinel", confidence: 0.88 }]
    },
    { ledger: [] }
  );

  assert.equal(decision.approved, true);
  assert.equal(decision.estimatedUsd, 0.09);
});

test("PolicyEngine blocks suspicious low-confidence or over-budget plans", () => {
  const engine = new PolicyEngine({
    maxUsdPerRun: 0.05,
    maxUsdPerDay: 0.1,
    minToolConfidence: 0.8
  });

  const decision = engine.assessRun(
    {
      steps: [{ estimatedUsd: 0.04 }, { estimatedUsd: 0.04 }],
      selectedTools: [{ id: "unknown-tool", confidence: 0.51 }]
    },
    { ledger: [] }
  );

  assert.equal(decision.approved, false);
  assert.equal(decision.reasons.length, 2);
});
