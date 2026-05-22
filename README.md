# SynapsePay Autonomous Agent

SynapsePay Autonomous Agent sengaja tidak mengejar website mewah. Fokusnya adalah bukti agent yang jalan sendiri:

- scheduled trigger tanpa approval manual
- SAP tool discovery sebelum eksekusi
- 3 distinct Ace Data Cloud AI service capabilities
- Sentinel verification
- x402-style payment ledger dan receipt per langkah
- policy guard agar volume tidak terlihat seperti loop spam

Default runtime adalah `demo`, jadi aman dijalankan tanpa private key. Mode `live` memakai adapter SAP SDK dan Ace x402 ketika environment, wallet, dan optional packages sudah siap.

## Run

```bash
npm.cmd start
```

Buka `http://127.0.0.1:8787`.

Run satu workflow dari terminal:

```bash
node scripts/run-once.js
```

Tes dasar:

```bash
npm.cmd test
```

Publish readiness check:

```bash
npm.cmd run publish:check
```

Di Windows, kalau `npm` PowerShell diblokir execution policy, gunakan `npm.cmd` untuk script package:

```bash
npm.cmd test
npm.cmd start
```

## Live Mode

1. Copy `.env.example` menjadi `.env`.
2. Isi `SAP_RPC_URL`, `SAP_WALLET_PATH`, `ACE_PLATFORM_TOKEN`, `ACE_X402_PRIVATE_KEY`, dan `ACE_X402_ORDER_ID` bila ingin membayar order Ace.
3. Generate wallet agent bila belum ada:

```bash
npm.cmd run wallet:generate
```

4. Install live dependencies:

```bash
npm.cmd install @oobe-protocol-labs/synapse-sap-sdk @coral-xyz/anchor @solana/web3.js x402-fetch viem
```

5. Cek readiness:

```bash
npm.cmd run live:check
```

6. Setelah wallet funded dan semua secret sudah valid, set:

```bash
AUTONOMY_MODE=live
ALLOW_ONCHAIN_MUTATIONS=true
```

Biarkan `ALLOW_ONCHAIN_MUTATIONS=false` untuk dry run live integration. Ubah menjadi `true` hanya setelah wallet, escrow, dan simulasi SAP sudah siap.

Register agent:

```bash
npm.cmd run sap:register
```

Reset evidence lokal sebelum membuat demo final agar tidak ada volume demo yang ikut terlihat:

```bash
npm.cmd run runtime:reset
```

## Demo Evidence

Runtime menulis bukti ke:

- `data/state.json` untuk status, metrics, runs, ledger
- `data/events.jsonl` untuk audit log append-only
- `data/reports/<runId>.json` untuk laporan workflow lengkap

Dashboard hanya membaca API lokal:

- `GET /api/status`
- `GET /api/readiness`
- `GET /api/events`
- `GET /api/runs`
- `GET /api/ledger`
- `GET /api/reports/latest`
- `GET /api/db`
- `POST /api/run`
- `POST /api/demo/run`
- `POST /api/start`
- `POST /api/stop`

## Bounty Alignment

- Payment volume: semua call berbayar masuk ke ledger dengan amount, network, asset, provider, receipt.
- Autonomous workflow: `AUTO_START=true` dan `RUN_ON_BOOT=true` menjalankan agent dari trigger ke report tanpa input manual.
- AI execution: workflow default memanggil tiga capability Ace, yaitu chat reasoning, embedding/risk signal, dan image/demo artifact.
- SAP integration: adapter melakukan discovery, manifest disiapkan di `config/agent.manifest.json`, dan Sentinel dipanggil sebagai langkah wajib.

## Publish Notes

- Jangan commit `.env`, `keys/agent.json`, atau `data/`; semuanya sudah masuk `.gitignore`.
- Gunakan `SUBMISSION.md` untuk checklist final dan draft post.
- Gunakan `DEMO_SCRIPT.md` sebagai alur video demo.
- Dashboard sengaja men-disable run live bila readiness belum lengkap, supaya tidak terlihat seperti agent palsu yang crash saat credential belum valid.

## References

- [Synapse SAP docs](https://explorer.oobeprotocol.ai/docs)
- [Synapse SAP SDK overview](https://explorer.oobeprotocol.ai/docs/sdk/overview)
- [Synapse SAP escrow/x402 API](https://explorer.oobeprotocol.ai/docs/sdk/escrow-api)
- [Ace Data Cloud x402 guide](https://docs.acedata.cloud/en/guides/x402)
