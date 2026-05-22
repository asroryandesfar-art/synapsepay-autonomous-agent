# SynapsePay Autonomous Agent

**Target category:** Ace Data Cloud Usage (x402 Facilitator)

SynapsePay is an autonomous SAP agent that discovers SAP tools, executes three Ace Data Cloud AI capabilities, records x402-style payment events, requests Sentinel verification, and writes an auditable proof report without manual approval inside policy limits.

This project is intentionally optimized for judges who need to inspect a repo and written submission quickly. The frontend is a proof dashboard, but the core value is the backend agent workflow.

## Live Demo

GitHub Pages frontend:

https://asroryandesfar-art.github.io/synapsepay-autonomous-agent/

GitHub Pages runs a static proof replay because Pages cannot host a Node agent/API. The real autonomous agent runs locally or on any Node host with:

```bash
npm.cmd start
```

## Why This Fits Ace Data Cloud Usage

The default workflow consumes three Ace Data Cloud style AI capabilities:

- `openai.chat.completions` for reasoning
- `openai.embeddings.create` for risk signal generation
- `images.generate` for demo artifact generation

Every Ace execution step becomes a payment ledger event with provider, step id, network, asset, amount, mode, and receipt metadata. Sentinel verification is recorded as a separate SAP-side payment proof.

## Judge Quick Review

| Judging signal | Where to inspect |
| --- | --- |
| Autonomous workflow | `src/agent/autonomousAgent.js` |
| Ace Data Cloud execution | `src/integrations/aceDataCloud.js`, `config/workflow.json` |
| x402 facilitator path | `src/integrations/aceDataCloud.js`, `package.json` dependencies |
| SAP integration | `src/integrations/sapClient.js`, `config/agent.manifest.json` |
| Sentinel verification | `src/agent/autonomousAgent.js`, `src/integrations/sapClient.js` |
| Payment ledger and volume metrics | `src/agent/policy.js`, `src/agent/stateStore.js` |
| Readiness/live safety guard | `src/readiness.js`, `.env.example` |
| Public proof dashboard | `public/index.html`, `public/app.js`, `public/styles.css` |

## Proof Matrix

| Requirement | Implementation |
| --- | --- |
| Highest Ace usage strategy | The agent executes three distinct Ace capabilities per proof run. |
| x402 payment handling | Uses `x402-fetch` and `viem` for live order payment flow, with demo-safe receipt fallback. |
| SAP agent behavior | Includes SAP discovery adapter, manifest, wallet config, and registration script. |
| Autonomous execution | Scheduler, boot run, manual run, and safe demo run are all supported by the same agent class. |
| Anti-spam policy | Budget and confidence checks block suspicious or over-budget runs. |
| Auditability | State, event log, ledger, and per-run JSON reports are written to local storage. |

## Run Locally

```bash
npm.cmd install
npm.cmd start
```

Open:

```text
http://127.0.0.1:8787/
```

Run one workflow from terminal:

```bash
npm.cmd run agent:once
```

Run checks:

```bash
npm.cmd test
npm.cmd run publish:check
```

## Live Mode

1. Copy `.env.example` to `.env`.
2. Fill `SAP_RPC_URL`, `SAP_WALLET_PATH`, `ACE_PLATFORM_TOKEN`, `ACE_X402_PRIVATE_KEY`, and `ACE_X402_ORDER_ID`.
3. Generate a wallet if needed:

```bash
npm.cmd run wallet:generate
```

4. Check live readiness:

```bash
npm.cmd run live:check
```

5. Register the SAP agent after wallet funding and dry-run validation:

```bash
npm.cmd run sap:register
```

6. Enable on-chain mutation only after credentials, wallet funding, and risk checks are complete:

```bash
AUTONOMY_MODE=live
ALLOW_ONCHAIN_MUTATIONS=true
```

## Important Safety Note

The repo does not fake live funded volume. If live credentials are missing, the dashboard shows `needs-secrets` and disables unsafe live execution. Demo proof mode is clearly separated from live mode so judges can inspect the implementation without risking keys or funds.

## Submission Text

Use `SUBMISSION.md` for the paste-ready bounty submission.
