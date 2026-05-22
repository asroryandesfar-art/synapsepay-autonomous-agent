import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);

export class SapIntegration {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.clientPromise = null;
  }

  async registerAgent(manifest) {
    if (this.config.mode !== "live") {
      return demoReceipt("sap-register", { manifestName: manifest.name });
    }
    const client = await this.getClient();
    if (!this.config.allowOnchainMutations) {
      return {
        simulated: true,
        skipped: true,
        reason: "ALLOW_ONCHAIN_MUTATIONS is false",
        manifest
      };
    }
    const signature = await client.agent.register(toSapRegistrationArgs(manifest));
    return { signature, manifestName: manifest.name };
  }

  async discoverTools(query) {
    if (this.config.mode !== "live") {
      return this.demoDiscovery(query);
    }

    try {
      const client = await this.getClient();
      if (client.discovery?.scan) {
        const result = await client.discovery.scan(query);
        return normalizeDiscovery(result);
      }
      return this.demoDiscovery(query, "SDK discovery.scan unavailable, using deterministic fallback");
    } catch (error) {
      await this.store.appendEvent({
        level: "warn",
        type: "sap.discovery.fallback",
        message: error.message
      });
      return this.demoDiscovery(query, "live discovery failed, using deterministic fallback");
    }
  }

  async callSentinel({ runId, toolName, evidence }) {
    if (this.config.mode !== "live") {
      return {
        verdict: "pass",
        score: 0.87,
        wallet: this.config.sap.sentinelWallet,
        toolName,
        receipt: demoReceipt("sentinel", { runId })
      };
    }

    const client = await this.getClient();
    if (client.x402?.call) {
      const response = await client.x402.call({
        agentWallet: this.config.sap.sentinelWallet,
        tool: toolName,
        args: evidence
      });
      return {
        verdict: response?.verdict || "submitted",
        score: response?.score || 0.75,
        wallet: this.config.sap.sentinelWallet,
        toolName,
        receipt: response?.receipt || response
      };
    }

    return {
      verdict: "queued",
      score: 0.7,
      wallet: this.config.sap.sentinelWallet,
      toolName,
      receipt: {
        simulated: true,
        reason: "client.x402.call unavailable in installed SDK"
      }
    };
  }

  async settle({ depositorWallet, calls, serviceData }) {
    if (this.config.mode !== "live") {
      return demoReceipt("sap-settle", { depositorWallet, calls, serviceData });
    }
    const client = await this.getClient();
    if (!this.config.allowOnchainMutations) {
      return {
        simulated: true,
        skipped: true,
        reason: "ALLOW_ONCHAIN_MUTATIONS is false"
      };
    }
    if (client.x402?.settle) {
      return client.x402.settle(depositorWallet, calls, serviceData);
    }
    throw new Error("Installed SAP SDK does not expose client.x402.settle");
  }

  async getClient() {
    if (!this.clientPromise) this.clientPromise = this.createClient();
    return this.clientPromise;
  }

  async createClient() {
    const sdk = requireCjs("@oobe-protocol-labs/synapse-sap-sdk");
    const { Keypair } = await import("@solana/web3.js");
    if (!this.config.sap.rpcUrl) throw new Error("SAP_RPC_URL is required in live mode");
    if (!this.config.sap.walletPath) throw new Error("SAP_WALLET_PATH is required in live mode");

    const rawWallet = await readFile(this.config.sap.walletPath, "utf8");
    const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawWallet)));
    if (sdk.SapConnection?.fromKeypair) {
      const connection = sdk.SapConnection.fromKeypair(this.config.sap.rpcUrl, keypair, {
        cluster: "mainnet-beta",
        commitment: "confirmed"
      });
      return connection.client || connection;
    }
    if (sdk.createSapClient) {
      return sdk.createSapClient(this.config.sap.rpcUrl, new LocalKeypairWallet(keypair));
    }
    throw new Error("Installed SAP SDK does not expose SapConnection.fromKeypair or createSapClient");
  }

  demoDiscovery(query, note = "demo mode") {
    const protocols = query.protocols || ["SAP", "x402"];
    return [
      {
        id: "sap.discovery.index",
        name: "SAP Network Discovery Index",
        protocol: protocols[0],
        confidence: 0.93,
        endpoint: "sap://discovery/scan",
        note
      },
      {
        id: "synapse.sentinel.audit",
        name: "Synapse Sentinel Audit Agent",
        protocol: "SAP",
        confidence: 0.9,
        wallet: this.config.sap.sentinelWallet,
        endpoint: "sap://sentinel/audit",
        note
      },
      {
        id: "ace.x402.facilitator",
        name: "Ace Data Cloud x402 Facilitator",
        protocol: "x402",
        confidence: 0.86,
        endpoint: "https://platform.acedata.cloud",
        note
      }
    ];
  }
}

class LocalKeypairWallet {
  constructor(keypair) {
    this.payer = keypair;
    this.publicKey = keypair.publicKey;
  }

  async signTransaction(transaction) {
    if ("partialSign" in transaction) {
      transaction.partialSign(this.payer);
    } else {
      transaction.sign([this.payer]);
    }
    return transaction;
  }

  async signAllTransactions(transactions) {
    for (const transaction of transactions) {
      await this.signTransaction(transaction);
    }
    return transactions;
  }
}

function toSapRegistrationArgs(manifest) {
  return {
    name: manifest.name,
    description: manifest.description,
    capabilities: (manifest.capabilities || []).map((capability) => ({
      id: capability.id,
      description: capability.description || null,
      protocolId: capability.protocolId || null,
      version: capability.version || null
    })),
    pricing: (manifest.pricing || []).map((tier) => ({
      tierId: tier.tierId,
      pricePerCall: BigInt(tier.pricePerCall || 0),
      minPricePerCall: tier.minPricePerCall == null ? null : BigInt(tier.minPricePerCall),
      maxPricePerCall: tier.maxPricePerCall == null ? null : BigInt(tier.maxPricePerCall),
      rateLimit: tier.rateLimit || 1,
      maxCallsPerSession: tier.maxCallsPerSession || 0,
      burstLimit: tier.burstLimit ?? null,
      tokenType: tokenType(tier.tokenType),
      tokenMint: tier.tokenMint || null,
      tokenDecimals: tier.tokenDecimals ?? (String(tier.tokenType).toLowerCase() === "usdc" ? 6 : 9),
      settlementMode: settlementMode(tier.settlementMode),
      minEscrowDeposit: tier.minEscrowDeposit == null ? null : BigInt(tier.minEscrowDeposit),
      batchIntervalSec: tier.batchIntervalSec ?? null,
      volumeCurve: tier.volumeCurve || null
    })),
    protocols: manifest.protocols || ["SAP", "x402"],
    agentId: manifest.agentId || null,
    agentUri: manifest.agentUri || null,
    x402Endpoint: manifest.x402Endpoint || null
  };
}

function tokenType(value) {
  const normalized = String(value || "sol").toLowerCase();
  if (normalized === "usdc") return { usdc: {} };
  if (normalized === "spl") return { spl: {} };
  return { sol: {} };
}

function settlementMode(value) {
  const normalized = String(value || "x402").toLowerCase();
  if (normalized === "instant") return { instant: {} };
  if (normalized === "escrow") return { escrow: {} };
  if (normalized === "batched") return { batched: {} };
  return { x402: {} };
}

function normalizeDiscovery(result) {
  const rows = Array.isArray(result) ? result : result?.tools || result?.agents || [];
  return rows.map((item, index) => ({
    id: item.id || item.address || `tool-${index}`,
    name: item.name || item.id || `SAP Tool ${index + 1}`,
    protocol: item.protocol || item.protocolId || "SAP",
    confidence: item.confidence || item.score || 0.7,
    endpoint: item.endpoint || item.x402Endpoint,
    pricing: item.pricing
  }));
}

function demoReceipt(kind, extra = {}) {
  return {
    simulated: true,
    kind,
    network: "demo-sap",
    asset: "USDC",
    signature: `demo_${kind}_${Date.now()}`,
    ...extra
  };
}
