import crypto from "node:crypto";

export class AceDataCloudIntegration {
  constructor(config) {
    this.config = config;
    this.fetchWithPaymentPromise = null;
  }

  async execute(step, context) {
    if (this.config.mode !== "live") {
      return this.demoExecute(step, context);
    }

    if (!this.config.ace.platformToken) {
      throw new Error("ACE_PLATFORM_TOKEN is required in live mode");
    }

    const fetchWithPayment = await this.getFetchWithPayment();
    const response = await fetchWithPayment(`${this.config.ace.baseUrl}/api/v1/agent/execute/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.ace.platformToken}`
      },
      body: JSON.stringify({
        service: step.serviceKind,
        capability: step.capability,
        prompt: step.prompt,
        context
      })
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Ace Data Cloud ${step.serviceKind} failed: ${response.status} ${bodyText}`);
    }

    return {
      serviceKind: step.serviceKind,
      capability: step.capability,
      output: parseJsonOrText(bodyText),
      payment: await this.decodePayment(response)
    };
  }

  async payOrder() {
    if (this.config.mode !== "live") {
      return {
        simulated: true,
        network: "base",
        asset: "USDC",
        orderId: this.config.ace.orderId || "demo-order",
        signature: `demo_ace_order_${Date.now()}`
      };
    }
    if (!this.config.ace.orderId) throw new Error("ACE_X402_ORDER_ID is required to pay an Ace order");
    const fetchWithPayment = await this.getFetchWithPayment();
    const response = await fetchWithPayment(
      `${this.config.ace.baseUrl}/api/v1/orders/${this.config.ace.orderId}/pay/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.ace.platformToken}`
        },
        body: JSON.stringify({ pay_way: "X402" })
      }
    );
    if (!response.ok) {
      throw new Error(`Ace x402 payment failed: ${response.status} ${await response.text()}`);
    }
    return this.decodePayment(response);
  }

  async getFetchWithPayment() {
    if (!this.fetchWithPaymentPromise) {
      this.fetchWithPaymentPromise = this.createFetchWithPayment();
    }
    return this.fetchWithPaymentPromise;
  }

  async createFetchWithPayment() {
    if (!this.config.ace.privateKey) {
      throw new Error("ACE_X402_PRIVATE_KEY is required in live mode");
    }
    const normalizedPrivateKey = this.config.ace.privateKey.startsWith("0x")
      ? this.config.ace.privateKey
      : `0x${this.config.ace.privateKey}`;
    const [{ wrapFetchWithPayment }, { createWalletClient, http }, { privateKeyToAccount }, { base }] = await Promise.all([
      import("x402-fetch"),
      import("viem"),
      import("viem/accounts"),
      import("viem/chains")
    ]);
    const account = privateKeyToAccount(normalizedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http()
    });
    return wrapFetchWithPayment(fetch, walletClient);
  }

  async decodePayment(response) {
    const header = response.headers.get("x-payment-response");
    if (!header) return null;
    try {
      const { decodeXPaymentResponse } = await import("x402-fetch");
      return decodeXPaymentResponse(header);
    } catch {
      return { raw: header };
    }
  }

  demoExecute(step, context) {
    const digest = crypto
      .createHash("sha256")
      .update(`${step.id}:${context.runId}:${step.prompt}`)
      .digest("hex");

    const outputs = {
      "openai.chat.completions": {
        summary:
          "Agent selected SAP discovery, executed three Ace capabilities, requested Sentinel verification, and recorded x402-style receipts under budget.",
        nextAction: "Publish demo proof and run live with funded SAP/Ace credentials."
      },
      "openai.embeddings.create": {
        vectorPreview: digest.slice(0, 24),
        riskScore: 0.18,
        legitimacySignals: ["scheduled trigger", "non-repeating task", "budget bound", "sentinel audit"]
      },
      "images.generate": {
        assetPrompt: step.prompt,
        artifactUrl: `demo://asset/${digest.slice(0, 12)}`,
        storyboardFrame: "trigger -> SAP discovery -> Ace execution -> x402 payment -> Sentinel audit"
      }
    };

    return {
      serviceKind: step.serviceKind,
      capability: step.capability,
      output: outputs[step.serviceKind] || { digest },
      payment: {
        simulated: true,
        network: "base",
        asset: "USDC",
        signature: `demo_ace_${step.id}_${Date.now()}`
      }
    };
  }
}

function parseJsonOrText(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
