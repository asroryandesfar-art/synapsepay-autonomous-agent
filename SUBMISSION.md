# SynapsePay Bounty Submission

## Category

**Primary category:** Ace Data Cloud Usage (x402 Facilitator)

**Secondary relevance:** General SAP payment workflow, because the agent also records SAP/Sentinel payment events and includes live escrow/readiness guards.

## Paste-Ready Submission

SynapsePay is an autonomous SAP agent built for Ace Data Cloud x402 usage. The agent discovers SAP tools, selects a valid workflow, executes three Ace Data Cloud AI capabilities, records x402-style payment events, requests Sentinel verification, and writes a complete audit report without manual approval inside policy limits.

The project targets the **Ace Data Cloud Usage (x402 Facilitator)** category because every proof run consumes three distinct Ace service capabilities: reasoning, embedding/risk signal, and image/demo artifact generation. Each service call is converted into a ledger entry with provider, step id, network, asset, amount, and receipt metadata.

Repo:
https://github.com/asroryandesfar-art/synapsepay-autonomous-agent

Live frontend demo:
https://asroryandesfar-art.github.io/synapsepay-autonomous-agent/

Key proof points:

- Autonomous trigger-to-report workflow in `src/agent/autonomousAgent.js`
- Ace Data Cloud execution adapter in `src/integrations/aceDataCloud.js`
- x402 live payment path using `x402-fetch` and `viem`
- SAP discovery and Sentinel adapter in `src/integrations/sapClient.js`
- Agent manifest in `config/agent.manifest.json`
- Workflow definition with three Ace capabilities in `config/workflow.json`
- Readiness guard that blocks unsafe live execution in `src/readiness.js`
- Payment ledger, event stream, and run reports exposed through the dashboard/API

The GitHub Pages demo shows a static proof replay because GitHub Pages cannot run a Node backend. The real autonomous agent runs with `npm.cmd start`, and `npm.cmd run publish:check` verifies syntax, tests, dependency imports, and live-readiness status.

## Evaluation Checklist

Run:

```bash
npm.cmd install
npm.cmd test
npm.cmd run publish:check
npm.cmd start
```

Open:

```text
http://127.0.0.1:8787/
```

Then press **Demo Proof** to inspect:

- one autonomous proof run
- 3 Ace AI service calls
- 4 total payment events
- x402-style ledger entries
- Sentinel `pass` verdict
- latest report proof
- readiness guard for live credentials

## Why It Should Score

SynapsePay is not just a frontend. It is a repo-level autonomous workflow:

1. It evaluates readiness and policy before execution.
2. It discovers SAP tools.
3. It executes multiple Ace AI capabilities.
4. It records payment volume per step.
5. It verifies with Sentinel.
6. It stores the result as an auditable report.

This directly matches the Ace Data Cloud usage goal: agent-driven AI service consumption with x402-oriented payment proof.
