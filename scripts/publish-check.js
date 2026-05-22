import { spawnSync } from "node:child_process";

const checks = [
  ["server syntax", "node", ["--check", "src/server.js"]],
  ["dashboard syntax", "node", ["--check", "public/app.js"]],
  ["tests", "node", ["--test", "tests/*.test.js"]],
  ["live readiness", "node", ["scripts/live-check.js"]]
];

const results = [];
for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, {
    shell: true,
    stdio: "pipe",
    encoding: "utf8"
  });
  results.push({
    name,
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  });
}

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
