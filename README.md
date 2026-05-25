# SynapsePay Autonomous Agent

SynapsePay is an autonomous payment agent for SAP + Ace Data Cloud.

It is not only a dashboard. The backend agent can trigger itself, discover SAP-capable services, execute Ace Data Cloud AI tools, record x402-style payment receipts, call Sentinel for verification, and persist every run as auditable JSON evidence.

## Submission Focus

**Primary track:** Ace Data Cloud Usage (x402 Facilitator)

**Secondary relevance:** General Payment Volume on SAP, because every run also produces SAP/Sentinel payment ledger evidence and x402 callback support.

The strongest judging angle is Ace usage: each successful proof run executes three distinct Ace service capabilities and turns those executions into payment ledger events.

## Links

Repository:

https://github.com/asroryandesfar-art/synapsepay-autonomous-agent

Live reviewer preview:

https://asroryandesfar-art.github.io/synapsepay-autonomous-agent/

GitHub Pages is a static reviewer preview. It uses `index.html`, `app.js`, and `styles.css` at the repo root, with a static proof replay because GitHub Pages cannot run the Node backend.

The real autonomous agent and API run locally or on a Node host with:

```bash
npm.cmd start
```

## What The Agent Does

```text
trigger / schedule
  -> readiness and budget guard
  -> SAP service discovery
  -> autonomous workflow planning
  -> Ace Data Cloud AI execution
  -> x402-style payment receipt per service call
  -> Sentinel verification
  -> JSON report + ledger + event log
```

## Judge Quick Review

| Judging signal | Evidence in repo |
| --- | --- |
| Autonomous workflow | `src/agent/autonomousAgent.js` |
| Scheduled/manual trigger | `src/agent/autonomousAgent.js`, `src/server.js` |
| Ace Data Cloud usage | `src/integrations/aceDataCloud.js`, `config/workflow.json` |
| Three Ace capabilities per proof run | `config/workflow.json` |
| x402 facilitator path | `src/integrations/aceDataCloud.js`, `src/server.js`, `package.json` |
| SAP discovery | `src/integrations/sapClient.js` |
| SAP agent manifest | `config/agent.manifest.json` |
| Sentinel verification | `src/agent/autonomousAgent.js`, `src/integrations/sapClient.js` |
| Payment ledger and volume metrics | `src/agent/policy.js`, `src/agent/stateStore.js` |
| Readiness/live safety guard | `src/readiness.js`, `.env.example` |
| API surface | `src/server.js` |
| GitHub Pages preview | `index.html`, `app.js`, `styles.css` |

## Ace Data Cloud Strategy

Each proof run targets three Ace Data Cloud style AI services:

| Step | Capability | Purpose | Estimated USD |
| --- | --- | --- | --- |
| `market-brief` | `openai.chat.completions` | Reasoning and market/payment brief | `$0.04` |
| `workflow-risk` | `openai.embeddings.create` | Risk and spam signal | `$0.03` |
| `demo-asset` | `images.generate` | Demo artifact generation | `$0.06` |

The Sentinel verification step is recorded separately as a SAP-side audit/payment event.

## Run Locally

```bash
npm.cmd install
npm.cmd start
```

Open:

```text
http://127.0.0.1:8787/
```

Run one agent workflow from the terminal:

```bash
npm.cmd run agent:once
```

Run validation:

```bash
npm.cmd test
npm.cmd run publish:check
```

## API Endpoints

The Node backend exposes the reviewer-facing agent API:

```text
GET  /api/status
GET  /api/health
GET  /api/readiness
GET  /api/events
GET  /api/runs
GET  /api/ledger
GET  /api/reports/latest
GET  /api/manifest
GET  /api/db
POST /api/run
POST /api/demo/run
POST /api/start
POST /api/stop
POST /api/x402
```

## Evidence Files

Runtime proof is generated under `data/`:

| File or folder | Meaning |
| --- | --- |
| `data/state.json` | Agent state, metrics, runs, ledger |
| `data/events.jsonl` | Append-only event stream |
| `data/reports/*.json` | Per-run proof reports |

These files are generated at runtime and are intentionally not committed with secrets or machine-specific state.

## Live Mode

1. Copy `.env.example` to `.env`.
2. Fill SAP and Ace credentials:

```text
SAP_RPC_URL
SAP_WALLET_PATH
SAP_AGENT_WALLET
ACE_PLATFORM_TOKEN
ACE_X402_ORDER_ID
ACE_X402_PRIVATE_KEY
```

3. Generate a wallet if needed:

```bash
npm.cmd run wallet:generate
```

4. Check readiness:

```bash
npm.cmd run live:check
```

5. Register the SAP agent:

```bash
npm.cmd run sap:register
```

6. Enable live mutation only after wallet funding and credential checks:

```text
AUTONOMY_MODE=live
ALLOW_ONCHAIN_MUTATIONS=true
```

## Safety And Honesty

This repo does not fake funded on-chain volume. Demo mode is marked as demo, GitHub Pages is marked as a static proof replay, and live execution is blocked until the required SAP/Ace credentials and wallet configuration pass readiness checks.

That is intentional: the submission is strongest when judges can trust the difference between demo proof, local autonomous execution, and live funded execution.
