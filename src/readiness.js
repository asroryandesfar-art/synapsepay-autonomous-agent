export function evaluateReadiness(config) {
  const checks = [
    check("sap_rpc_url", "SAP RPC URL", realValue(config.sap.rpcUrl), "Set SAP_RPC_URL to a real Synapse RPC endpoint."),
    check("sap_wallet_path", "SAP wallet path", realValue(config.sap.walletPath), "Set SAP_WALLET_PATH."),
    check("sap_agent_wallet", "SAP agent wallet", realValue(config.sap.agentWallet), "Set SAP_AGENT_WALLET to the wallet public key."),
    check("ace_platform_token", "Ace platform token", realValue(config.ace.platformToken), "Set ACE_PLATFORM_TOKEN."),
    check(
      "ace_x402_private_key",
      "Ace x402 private key",
      isHexPrivateKey(config.ace.privateKey),
      "Set ACE_X402_PRIVATE_KEY to a 32-byte EVM private key."
    ),
    check("ace_x402_order_id", "Ace order id", realValue(config.ace.orderId), "Set ACE_X402_ORDER_ID."),
    check(
      "onchain_guard",
      "On-chain mutation guard",
      config.allowOnchainMutations,
      "Set ALLOW_ONCHAIN_MUTATIONS=true only after wallet funding and dry-run validation."
    )
  ];

  const requiredForLiveRun = [
    "sap_rpc_url",
    "sap_wallet_path",
    "sap_agent_wallet",
    "ace_platform_token",
    "ace_x402_private_key"
  ];
  const requiredForSapRegister = ["sap_rpc_url", "sap_wallet_path", "sap_agent_wallet", "onchain_guard"];
  const runReady = config.mode === "demo" || requiredForLiveRun.every((id) => checks.find((item) => item.id === id)?.ok);
  const registerReady =
    config.mode === "live" && requiredForSapRegister.every((id) => checks.find((item) => item.id === id)?.ok);
  const credentialReady = requiredForLiveRun.every((id) => checks.find((item) => item.id === id)?.ok);

  return {
    mode: config.mode,
    status: readinessStatus(config, { runReady, registerReady, credentialReady }),
    runReady,
    registerReady,
    credentialReady,
    autoStartReady: runReady && (config.mode === "demo" || config.allowOnchainMutations),
    missing: checks.filter((item) => !item.ok).map((item) => item.id),
    checks
  };
}

export function assertRunReady(config) {
  const readiness = evaluateReadiness(config);
  if (!readiness.runReady) {
    const missing = readiness.checks.filter((item) => !item.ok && item.id !== "onchain_guard");
    const details = missing.map((item) => item.label).join(", ");
    return {
      ok: false,
      readiness,
      reason: `Live preflight blocked: ${details || "configuration is incomplete"}`
    };
  }
  return { ok: true, readiness };
}

function readinessStatus(config, values) {
  if (config.mode === "demo") return "demo-ready";
  if (values.registerReady) return "live-ready";
  if (values.credentialReady && !config.allowOnchainMutations) return "live-guarded";
  return "needs-secrets";
}

function check(id, label, ok, action) {
  return { id, label, ok: Boolean(ok), action };
}

function realValue(value) {
  if (!value) return false;
  const text = String(value);
  if (text.includes("YOUR_")) return false;
  if (text.includes("YOUR-")) return false;
  if (text.includes("0xYOUR_")) return false;
  if (text.includes("YOUR_SYNapse")) return false;
  return true;
}

function isHexPrivateKey(value) {
  if (!realValue(value)) return false;
  return /^0x[0-9a-fA-F]{64}$/.test(String(value));
}
