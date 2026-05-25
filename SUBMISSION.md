# SynapsePay Bounty Submission

## Primary Category

**Ace Data Cloud Usage (x402 Facilitator)**

## Secondary Relevance

**General Payment Volume on SAP**

SynapsePay also records SAP/Sentinel payment events, exposes an x402 callback endpoint, and maintains a payment ledger. The primary competition angle remains Ace Data Cloud usage because the agent consumes multiple Ace AI services per autonomous run.

## Paste-Ready Submission

SynapsePay is an autonomous SAP payment agent for Ace Data Cloud x402 usage.

This is not just a payment dashboard. The agent independently evaluates readiness, discovers SAP-capable services, plans a workflow, executes Ace Data Cloud AI tools, records x402-style payment receipts, verifies the run with Sentinel, and writes an auditable JSON report without manual approval inside configured policy limits.

Repo:

https://github.com/asroryandesfar-art/synapsepay-autonomous-agent

Live reviewer preview:

https://asroryandesfar-art.github.io/synapsepay-autonomous-agent/

The strongest category fit is **Ace Data Cloud Usage (x402 Facilitator)**. Each proof run includes three Ace service calls:

- `openai.chat.completions` for reasoning and market/payment brief
- `openai.embeddings.create` for risk/spam signal generation
- `images.generate` for demo artifact generation

Each Ace execution becomes a ledger entry with provider, step id, network, asset, amount, mode, and receipt metadata. The workflow then calls Sentinel for verification and stores the final report in `data/reports/*.json`.

## Why This Is Autonomous

The agent workflow is implemented in `src/agent/autonomousAgent.js`:

1. Trigger starts from schedule, boot, manual API call, or demo proof.
2. `assertRunReady` blocks unsafe live execution when credentials or wallet setup are missing.
3. The planner scores the signal before deciding whether to run.
4. SAP discovery selects relevant tools.
5. Policy checks budget and confidence limits.
6. Ace Data Cloud services execute automatically.
7. Every paid service call is converted into a payment ledger event.
8. Sentinel verifies the evidence.
9. The agent writes state, events, ledger, and a per-run report.

## Key Proof Points

| Claim | Evidence |
| --- | --- |
| Autonomous trigger-to-report workflow | `src/agent/autonomousAgent.js` |
| Ace Data Cloud usage | `src/integrations/aceDataCloud.js`, `config/workflow.json` |
| Three Ace capabilities per run | `config/workflow.json` |
| x402 payment/facilitator path | `src/integrations/aceDataCloud.js`, `src/server.js`, `package.json` |
| SAP discovery | `src/integrations/sapClient.js` |
| SAP registration/manifest | `scripts/register-agent.js`, `config/agent.manifest.json` |
| Sentinel audit | `src/integrations/sapClient.js`, `src/agent/autonomousAgent.js` |
| Payment volume ledger | `src/agent/policy.js`, `src/agent/stateStore.js` |
| API/dashboard demo | `src/server.js`, `public/`, root GitHub Pages files |
| Live safety guard | `src/readiness.js`, `.env.example` |

## Reviewer Commands

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

Run a local proof:

```bash
npm.cmd run agent:once
```

Or use the API/dashboard button:

```text
POST /api/demo/run
```

## What Reviewers Should See

After a proof run, reviewers can inspect:

- 3 Ace AI service executions
- 4 payment events total, including Sentinel verification
- payment ledger entries with provider, network, asset, amount, and receipt metadata
- `data/events.jsonl` append-only event stream
- `data/state.json` metrics and ledger
- `data/reports/*.json` final run report
- readiness guard separating demo from live funded execution

## Why It Should Score

SynapsePay directly matches the bounty goals:

- **Payment volume:** every service step records a payment event and contributes to ledger volume.
- **Autonomous workflow:** the agent goes from trigger to verified report without manual approval.
- **AI execution:** the workflow executes multiple Ace Data Cloud AI capabilities per run.
- **SAP integration:** the repo includes SAP discovery, a SAP agent manifest, Sentinel verification, registration script, and x402 callback endpoint.

The frontend is intentionally secondary. The value is the autonomous backend workflow plus auditable payment evidence.

## Important Note

The GitHub Pages demo is a static reviewer preview because GitHub Pages cannot host the Node agent/API. Live funded execution requires `.env` credentials, wallet funding, readiness validation, and:

```text
AUTONOMY_MODE=live
ALLOW_ONCHAIN_MUTATIONS=true
```

The repo does not mislabel demo volume as funded on-chain volume.
