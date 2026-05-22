# SynapsePay Submission Guide

## Category Fit

This project is built for the autonomous-agent judging criteria:

- SAP tool discovery before execution
- Ace Data Cloud AI execution with three distinct capabilities
- x402 payment handling and receipts
- Sentinel verification
- scheduled trigger-to-payment workflow with no human approval inside policy limits

## Demo Flow

1. Start the local console:

```bash
npm.cmd start
```

2. Open:

```text
http://127.0.0.1:8787/
```

3. Show the readiness panel first. In `demo` it should be ready. In `live`, it should clearly show missing credentials or the mutation guard.
4. Run one workflow only after readiness is green.
5. Open the generated report in `data/reports/<runId>.json`.
6. Show the ledger entries: Ace service calls, Sentinel audit, and x402-style receipts.

## Live Launch Checklist

Before turning on real network execution:

- `npm.cmd run live:check` passes for SAP RPC, wallet, Ace token, Ace x402 private key, and order id.
- The Solana wallet in `SAP_AGENT_WALLET` is funded.
- `ALLOW_ONCHAIN_MUTATIONS=true` is set only after dry-run validation.
- `npm.cmd run sap:register` returns an on-chain signature.
- `npm.cmd run runtime:reset` has been run before recording the final demo.
- `AUTO_START=true` and `RUN_ON_BOOT=true` are set only when the agent should run unattended.

## Suggested X Post

Built SynapsePay Autonomous Agent for the OOBE x Ace bounty.

It discovers SAP tools, executes 3 Ace AI capabilities, records x402 payment receipts, calls Sentinel, and writes an auditable run report without manual approval.

Category: Ace Data Cloud Usage + SAP payment workflow.

Repo: <your GitHub URL>
Demo: <your video URL>

Tag: @OOBEonSol @AceDataCloud
