import crypto from "node:crypto";

export class Planner {
  constructor(workflow) {
    this.workflow = workflow;
  }

  async shouldTrigger(signal) {
    const keywords = this.workflow.trigger.signalKeywords || [];
    const text = `${signal.title || ""} ${signal.body || ""}`.toLowerCase();
    const hits = keywords.filter((word) => text.includes(word.toLowerCase()));
    const score = Math.min(1, 0.45 + hits.length * 0.14 + (signal.scheduled ? 0.2 : 0));
    return {
      triggered: score >= this.workflow.trigger.minimumScore,
      score,
      hits
    };
  }

  buildPlan({ signal, discoveredTools }) {
    const selectedTools = this.selectTools(discoveredTools);
    const aceSteps = this.workflow.aceServices.map((service, index) => ({
      id: service.id,
      type: "ace-service",
      order: index + 1,
      serviceKind: service.kind,
      capability: service.capability,
      prompt: service.prompt,
      estimatedUsd: service.estimatedUsd
    }));

    const sentinelStep = {
      id: "sentinel-verification",
      type: "sap-sentinel",
      order: aceSteps.length + 1,
      toolName: this.workflow.sentinel.toolName,
      estimatedUsd: this.workflow.sentinel.estimatedUsd
    };

    const paymentStep = {
      id: "settlement-proof",
      type: "payment-summary",
      order: aceSteps.length + 2,
      estimatedUsd: 0
    };

    return {
      id: createPlanId(signal),
      objective: this.workflow.objective,
      selectedTools,
      steps: [...aceSteps, sentinelStep, paymentStep],
      createdAt: new Date().toISOString()
    };
  }

  selectTools(discoveredTools) {
    const tools = discoveredTools.length ? discoveredTools : this.demoTools();
    return tools
      .filter((tool) => tool.confidence >= 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.workflow.sapDiscovery.maxTools);
  }

  demoTools() {
    return [
      {
        id: "sap-tool-discovery",
        name: "SAP Tool Discovery",
        protocol: "SAP",
        confidence: 0.91,
        pricing: { mode: "x402", estimatedUsd: 0.01 }
      },
      {
        id: "synapse-sentinel",
        name: "Synapse Sentinel",
        protocol: "SAP",
        confidence: 0.88,
        pricing: { mode: "x402", estimatedUsd: 0.02 }
      },
      {
        id: "ace-ai-router",
        name: "Ace Data Cloud AI Router",
        protocol: "AceDataCloud",
        confidence: 0.84,
        pricing: { mode: "x402", estimatedUsd: 0.04 }
      }
    ];
  }
}

function createPlanId(signal) {
  const hash = crypto
    .createHash("sha256")
    .update(`${signal.id}:${signal.ts}:${signal.body || ""}`)
    .digest("hex")
    .slice(0, 10);
  return `plan_${hash}`;
}
