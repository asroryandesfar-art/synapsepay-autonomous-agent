# SynapsePay Repo Review Guide

This bounty submission does not require a video. Use this guide if a reviewer wants to inspect the repo quickly.

## Read First

1. `README.md` for category fit and architecture.
2. `SUBMISSION.md` for the paste-ready bounty text.
3. `config/workflow.json` for the three Ace Data Cloud capabilities.
4. `src/agent/autonomousAgent.js` for the autonomous workflow.
5. `src/integrations/aceDataCloud.js` for x402/Ace execution.
6. `src/integrations/sapClient.js` for SAP discovery and Sentinel.

## Local Proof

```bash
npm.cmd install
npm.cmd run publish:check
npm.cmd start
```

Open:

```text
http://127.0.0.1:8787/
```

Click **Demo Proof** and check:

- `autonomous: true` in the generated report
- three Ace `distinctServices`
- Sentinel verdict
- x402-style ledger rows
- payment volume metric
- readiness guard for live credentials
