import crypto from "node:crypto";
import { AceDataCloudIntegration } from "../integrations/aceDataCloud.js";
import { SapIntegration } from "../integrations/sapClient.js";
import { assertRunReady } from "../readiness.js";
import { Planner } from "./planner.js";
import { PolicyEngine } from "./policy.js";

export class AutonomousAgent {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.sap = new SapIntegration(config, store);
    this.ace = new AceDataCloudIntegration(config);
    this.planner = new Planner(config.workflow);
    this.policy = new PolicyEngine(config.policy);
    this.timer = null;
    this.running = false;
  }

  async start() {
    if (this.timer) return;
    const now = Date.now();
    await this.store.update((state) => {
      state.status = "scheduled";
      state.startedAt ||= new Date().toISOString();
      state.nextRunAt = new Date(now + this.config.runIntervalMs).toISOString();
      return state;
    });
    this.timer = setInterval(() => {
      this.runOnce({ source: "schedule" }).catch((error) => {
        this.store.appendEvent({
          level: "error",
          type: "agent.run.unhandled",
          message: error.message
        });
      });
    }, this.config.runIntervalMs);
    this.timer.unref?.();

    if (this.config.runOnBoot) {
      await this.runOnce({ source: "boot" });
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.store.update((state) => {
      state.status = "idle";
      state.nextRunAt = null;
      return state;
    });
  }

  async runOnce(trigger = { source: "manual" }) {
    if (this.running) {
      await this.store.appendEvent({
        level: "info",
        type: "agent.run.skipped",
        message: "run already active"
      });
      return null;
    }

    this.running = true;
    const runId = createRunId(trigger.source);
    const startedAt = new Date().toISOString();

    try {
      await this.markRunStarted(runId, startedAt, trigger);
      const runReadiness = assertRunReady(this.config);
      if (!runReadiness.ok) {
        await this.store.appendEvent({
          level: "warn",
          type: "agent.readiness.blocked",
          runId,
          reason: runReadiness.reason,
          missing: runReadiness.readiness.missing
        });
        return this.completeRun(runId, {
          status: "blocked",
          reason: runReadiness.reason,
          readiness: runReadiness.readiness
        });
      }

      const signal = await this.buildSignal(runId, trigger);
      const triggerDecision = await this.planner.shouldTrigger(signal);
      await this.store.appendEvent({
        level: "info",
        type: "agent.trigger.assessed",
        runId,
        score: triggerDecision.score,
        hits: triggerDecision.hits
      });

      if (!triggerDecision.triggered) {
        return this.completeRun(runId, {
          status: "skipped",
          reason: "trigger score below threshold",
          triggerDecision
        });
      }

      const discoveredTools = await this.sap.discoverTools(this.config.workflow.sapDiscovery);
      const plan = this.planner.buildPlan({ signal, discoveredTools });
      const state = await this.store.readState();
      const policyDecision = this.policy.assessRun(plan, state);

      await this.store.appendEvent({
        level: policyDecision.approved ? "info" : "warn",
        type: "agent.policy.assessed",
        runId,
        approved: policyDecision.approved,
        estimatedUsd: policyDecision.estimatedUsd,
        reasons: policyDecision.reasons
      });

      if (!policyDecision.approved) {
        return this.completeRun(runId, {
          status: "blocked",
          reason: "policy rejected run",
          policyDecision,
          plan
        });
      }

      const evidence = {
        runId,
        signal,
        plan,
        discoveredTools,
        aceResults: [],
        sentinel: null,
        payments: []
      };

      for (const step of plan.steps) {
        if (step.type === "ace-service") {
          const result = await this.executeAceStep(runId, step, evidence);
          evidence.aceResults.push(result);
          evidence.payments.push(result.paymentEvent);
        } else if (step.type === "sap-sentinel") {
          const result = await this.executeSentinelStep(runId, step, evidence);
          evidence.sentinel = result;
          evidence.payments.push(result.paymentEvent);
        } else if (step.type === "payment-summary") {
          await this.store.appendEvent({
            level: "info",
            type: "agent.payment.summary",
            runId,
            payments: evidence.payments.length,
            estimatedUsd: evidence.payments.reduce((sum, item) => sum + item.usdAmount, 0)
          });
        }
      }

      const report = this.buildReport({ runId, startedAt, evidence, policyDecision });
      const reportPath = await this.store.writeReport(runId, report);

      return this.completeRun(runId, {
        status: "success",
        reportPath,
        report
      });
    } catch (error) {
      await this.store.appendEvent({
        level: "error",
        type: "agent.run.failed",
        runId,
        message: error.message,
        stack: error.stack
      });
      return this.completeRun(runId, {
        status: "failed",
        error: error.message
      });
    } finally {
      this.running = false;
    }
  }

  async executeAceStep(runId, step, evidence) {
    await this.store.appendEvent({
      level: "info",
      type: "ace.call.started",
      runId,
      stepId: step.id,
      serviceKind: step.serviceKind
    });

    const result = await this.ace.execute(step, {
      runId,
      selectedTools: evidence.plan.selectedTools,
      signal: evidence.signal
    });

    const paymentEvent = this.policy.buildPaymentEvent({
      runId,
      step,
      provider: "AceDataCloud",
      receipt: result.payment,
      mode: this.config.mode
    });
    await this.recordPayment(paymentEvent);

    await this.store.appendEvent({
      level: "info",
      type: "ace.call.completed",
      runId,
      stepId: step.id,
      serviceKind: step.serviceKind,
      receipt: result.payment
    });

    return {
      step,
      result,
      paymentEvent
    };
  }

  async executeSentinelStep(runId, step, evidence) {
    await this.store.appendEvent({
      level: "info",
      type: "sentinel.call.started",
      runId,
      wallet: this.config.sap.sentinelWallet
    });

    const sentinel = await this.sap.callSentinel({
      runId,
      toolName: step.toolName,
      evidence: summarizeEvidence(evidence)
    });
    const paymentEvent = this.policy.buildPaymentEvent({
      runId,
      step,
      provider: "SynapseSentinel",
      receipt: sentinel.receipt,
      mode: this.config.mode
    });
    await this.recordPayment(paymentEvent);

    await this.store.appendEvent({
      level: "info",
      type: "sentinel.call.completed",
      runId,
      verdict: sentinel.verdict,
      score: sentinel.score,
      receipt: sentinel.receipt
    });

    return {
      step,
      result: sentinel,
      paymentEvent
    };
  }

  async recordPayment(paymentEvent) {
    await this.store.update((state) => {
      state.ledger.push(paymentEvent);
      state.metrics.paymentEvents += 1;
      state.metrics.estimatedUsdVolume = roundMetric(
        state.metrics.estimatedUsdVolume + paymentEvent.usdAmount
      );
      return state;
    });
  }

  buildReport({ runId, startedAt, evidence, policyDecision }) {
    const completedAt = new Date().toISOString();
    const totalUsd = evidence.payments.reduce((sum, item) => sum + item.usdAmount, 0);
    return {
      runId,
      startedAt,
      completedAt,
      mode: this.config.mode,
      autonomous: true,
      trigger: evidence.signal,
      sapDiscovery: {
        toolsFound: evidence.discoveredTools.length,
        selectedTools: evidence.plan.selectedTools
      },
      aceExecution: {
        distinctServices: [...new Set(evidence.aceResults.map((item) => item.step.serviceKind))],
        results: evidence.aceResults.map((item) => ({
          stepId: item.step.id,
          serviceKind: item.step.serviceKind,
          capability: item.step.capability,
          output: item.result.output,
          receipt: item.result.payment
        }))
      },
      sentinel: evidence.sentinel?.result,
      paymentLedger: evidence.payments,
      paymentSummary: {
        events: evidence.payments.length,
        estimatedUsd: roundMetric(totalUsd),
        networks: [...new Set(evidence.payments.map((item) => item.network))],
        assets: [...new Set(evidence.payments.map((item) => item.asset))]
      },
      policyDecision
    };
  }

  async buildSignal(runId, trigger) {
    let external = null;
    if (this.config.signalSourceUrl) {
      try {
        const response = await fetch(this.config.signalSourceUrl);
        external = response.ok ? await response.text() : null;
      } catch (error) {
        await this.store.appendEvent({
          level: "warn",
          type: "signal.fetch.failed",
          runId,
          message: error.message
        });
      }
    }

    return {
      id: runId,
      ts: new Date().toISOString(),
      source: trigger.source,
      scheduled: ["schedule", "boot", "demo-schedule"].includes(trigger.source),
      title: "SAP x402 autonomous payment opportunity",
      body:
        external ||
        "Scheduled check for SAP agent tools, Ace Data Cloud AI services, x402 settlement, and Sentinel verification."
    };
  }

  async markRunStarted(runId, startedAt, trigger) {
    await this.store.update((state) => {
      state.status = "running";
      state.activeRunId = runId;
      state.lastRunAt = startedAt;
      state.lastRunId = runId;
      state.runs.unshift({
        runId,
        status: "running",
        trigger: trigger.source,
        startedAt,
        completedAt: null
      });
      state.runs = state.runs.slice(0, 30);
      return state;
    });
    await this.store.appendEvent({
      level: "info",
      type: "agent.run.started",
      runId,
      trigger: trigger.source
    });
  }

  async completeRun(runId, result) {
    const completedAt = new Date().toISOString();
    const nextRunAt = this.timer
      ? new Date(Date.now() + this.config.runIntervalMs).toISOString()
      : null;

    const state = await this.store.update((current) => {
      current.status = this.timer ? "scheduled" : "idle";
      current.activeRunId = null;
      current.nextRunAt = nextRunAt;
      current.metrics.totalRuns += 1;
      if (result.status === "success") {
        current.metrics.successfulRuns += 1;
        current.metrics.autonomousRuns += 1;
        current.metrics.sapDiscoveries += 1;
        current.metrics.aceServiceCalls += this.config.workflow.aceServices.length;
        current.metrics.sentinelCalls += 1;
      } else if (result.status === "failed") {
        current.metrics.failedRuns += 1;
      } else if (result.status === "blocked") {
        current.metrics.blockedRuns = (current.metrics.blockedRuns || 0) + 1;
      }

      const run = current.runs.find((item) => item.runId === runId);
      if (run) {
        run.status = result.status;
        run.completedAt = completedAt;
        run.summary = summarizeResult(result);
      }
      return current;
    });

    await this.store.appendEvent({
      level: result.status === "success" ? "info" : "warn",
      type: "agent.run.completed",
      runId,
      status: result.status,
      summary: summarizeResult(result)
    });

    return { runId, completedAt, result, state };
  }
}

function createRunId(source) {
  const time = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const nonce = crypto.randomBytes(3).toString("hex");
  return `run_${time}_${source}_${nonce}`;
}

function summarizeEvidence(evidence) {
  return {
    runId: evidence.runId,
    planId: evidence.plan.id,
    selectedTools: evidence.plan.selectedTools.map((tool) => ({
      id: tool.id,
      protocol: tool.protocol,
      confidence: tool.confidence
    })),
    aceServices: evidence.aceResults.map((item) => item.step.serviceKind),
    paymentEvents: evidence.payments.length
  };
}

function summarizeResult(result) {
  if (result.status === "success") {
    return {
      reportPath: result.reportPath,
      paymentEvents: result.report.paymentSummary.events,
      estimatedUsd: result.report.paymentSummary.estimatedUsd,
      aceServices: result.report.aceExecution.distinctServices
    };
  }
  return {
    reason: result.reason || result.error || result.status
  };
}

function roundMetric(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}
