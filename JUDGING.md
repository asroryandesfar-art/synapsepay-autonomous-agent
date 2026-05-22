# Judging Notes

## Best Category

Submit this project primarily to:

**Ace Data Cloud Usage (x402 Facilitator)**

Reason: the agent is designed around repeated Ace Data Cloud service consumption and records each AI service call as a payment ledger event.

## What Makes It Competitive

- The repo contains a working autonomous agent, not only a static website.
- The workflow has three distinct Ace AI capabilities per run.
- The agent records payment amount, provider, step, network, asset, and receipt metadata.
- The SAP integration is represented by discovery, manifest, registration, and Sentinel adapter code.
- Live execution is guarded instead of pretending that missing credentials are valid.
- The dashboard exposes evidence that maps directly to judging criteria.

## Files That Matter Most

- `src/agent/autonomousAgent.js`
- `src/integrations/aceDataCloud.js`
- `src/integrations/sapClient.js`
- `src/agent/policy.js`
- `src/readiness.js`
- `config/workflow.json`
- `config/agent.manifest.json`
- `public/app.js`
- `SUBMISSION.md`

## If Only One Link Is Allowed

Submit the GitHub repo:

https://github.com/asroryandesfar-art/synapsepay-autonomous-agent

The live demo is also available:

https://asroryandesfar-art.github.io/synapsepay-autonomous-agent/
