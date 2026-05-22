import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { loadConfig } from "../src/config.js";
import { evaluateReadiness } from "../src/readiness.js";

const requireCjs = createRequire(import.meta.url);
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadConfig(cwd);
const checks = [];

await check("SAP SDK CJS import", async () => {
  const sdk = requireCjs("@oobe-protocol-labs/synapse-sap-sdk");
  return Boolean(sdk.SapConnection || sdk.createSapClient);
});

await check("x402 + viem imports", async () => {
  const [{ wrapFetchWithPayment }, { createWalletClient }, { privateKeyToAccount }] = await Promise.all([
    import("x402-fetch"),
    import("viem"),
    import("viem/accounts")
  ]);
  return Boolean(wrapFetchWithPayment && createWalletClient && privateKeyToAccount);
});

await check("SAP_RPC_URL configured", async () => realValue(config.sap.rpcUrl));
await check("SAP wallet file configured", async () => realValue(config.sap.walletPath));

let walletPublicKey = null;
await check("SAP wallet file readable", async () => {
  const raw = await readFile(config.sap.walletPath, "utf8");
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  walletPublicKey = keypair.publicKey.toBase58();
  return true;
});

await check("SAP wallet balance", async () => {
  if (!walletPublicKey || !realValue(config.sap.rpcUrl)) return false;
  const connection = new Connection(config.sap.rpcUrl, "confirmed");
  const raw = await readFile(config.sap.walletPath, "utf8");
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  const lamports = await connection.getBalance(keypair.publicKey);
  return { publicKey: walletPublicKey, sol: lamports / LAMPORTS_PER_SOL };
});

await check("Ace token configured", async () => realValue(config.ace.platformToken));
await check("Ace x402 private key configured", async () => realValue(config.ace.privateKey));
await check("Ace order id configured", async () => realValue(config.ace.orderId));
await check("On-chain mutation guard", async () => ({
  allowOnchainMutations: config.allowOnchainMutations,
  readyForRegistration: config.mode === "live" && config.allowOnchainMutations
}));

console.log(JSON.stringify({ mode: config.mode, readiness: evaluateReadiness(config), checks }, null, 2));

async function check(name, fn) {
  try {
    const result = await fn();
    checks.push({ name, ok: Boolean(result), result: redact(result) });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

function realValue(value) {
  if (!value) return false;
  if (String(value).includes("YOUR_")) return false;
  if (String(value).includes("0xYOUR_")) return false;
  return true;
}

function redact(value) {
  if (typeof value === "string") return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
  return value;
}
