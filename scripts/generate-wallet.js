import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const walletPath = path.join(cwd, "keys", "agent.json");

await mkdir(path.dirname(walletPath), { recursive: true });

try {
  await readFile(walletPath, "utf8");
  console.log(JSON.stringify({ created: false, walletPath, note: "wallet already exists" }, null, 2));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const keypair = Keypair.generate();
  await writeFile(walletPath, `${JSON.stringify(Array.from(keypair.secretKey))}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  console.log(
    JSON.stringify(
      {
        created: true,
        walletPath,
        publicKey: keypair.publicKey.toBase58(),
        next: "Fund this Solana wallet before setting ALLOW_ONCHAIN_MUTATIONS=true."
      },
      null,
      2
    )
  );
}
