export class PolicyEngine {
  constructor(policy) {
    this.policy = policy;
  }

  assessRun(plan, state) {
    const estimated = roundMoney(plan.steps.reduce((sum, step) => sum + (step.estimatedUsd || 0), 0));
    const spentToday = roundMoney(
      state.ledger
        .filter((item) => sameUtcDay(item.ts, new Date().toISOString()))
        .reduce((sum, item) => sum + (item.usdAmount || 0), 0)
    );

    const reasons = [];
    if (estimated > this.policy.maxUsdPerRun) {
      reasons.push(`estimated run cost ${estimated} exceeds max ${this.policy.maxUsdPerRun}`);
    }
    if (spentToday + estimated > this.policy.maxUsdPerDay) {
      reasons.push(`daily cost ${spentToday + estimated} exceeds max ${this.policy.maxUsdPerDay}`);
    }
    for (const tool of plan.selectedTools) {
      if ((tool.confidence || 0) < this.policy.minToolConfidence) {
        reasons.push(`tool ${tool.id} confidence ${tool.confidence} below ${this.policy.minToolConfidence}`);
      }
    }

    return {
      approved: reasons.length === 0,
      reasons,
      estimatedUsd: estimated,
      spentToday
    };
  }

  buildPaymentEvent({ runId, step, provider, receipt, mode }) {
    return {
      id: `${runId}:${step.id}:${Date.now()}`,
      runId,
      stepId: step.id,
      provider,
      mode,
      ts: new Date().toISOString(),
      usdAmount: roundMoney(step.estimatedUsd || 0),
      currency: "USD",
      network: receipt?.network || "demo-ledger",
      asset: receipt?.asset || "USDC",
      receipt
    };
  }
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function sameUtcDay(a, b) {
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}
