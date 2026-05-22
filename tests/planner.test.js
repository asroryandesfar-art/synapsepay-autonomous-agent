import test from "node:test";
import assert from "node:assert/strict";
import workflow from "../config/workflow.json" with { type: "json" };
import { Planner } from "../src/agent/planner.js";

test("Planner triggers on scheduled SAP x402 signal", async () => {
  const planner = new Planner(workflow);
  const decision = await planner.shouldTrigger({
    scheduled: true,
    title: "SAP x402 autonomous payment",
    body: "agent workflow on Solana"
  });

  assert.equal(decision.triggered, true);
  assert.ok(decision.score >= workflow.trigger.minimumScore);
});

test("Planner builds a complete autonomous workflow plan", () => {
  const planner = new Planner(workflow);
  const plan = planner.buildPlan({
    signal: { id: "run-1", ts: new Date().toISOString(), body: "sap x402 agent" },
    discoveredTools: [
      { id: "tool-a", confidence: 0.9, protocol: "SAP" },
      { id: "tool-b", confidence: 0.7, protocol: "x402" }
    ]
  });

  assert.equal(plan.steps.filter((step) => step.type === "ace-service").length, 3);
  assert.equal(plan.steps.some((step) => step.type === "sap-sentinel"), true);
  assert.equal(plan.steps.some((step) => step.type === "payment-summary"), true);
});
