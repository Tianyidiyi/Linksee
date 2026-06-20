import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiDir, "../..");
const dockerEnvPath = path.join(repoRoot, "infra", "docker", ".env");
const localEnvPath = path.join(apiDir, ".env");

if (fs.existsSync(dockerEnvPath)) {
  dotenv.config({ path: dockerEnvPath });
}
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node ./scripts/prisma-env.mjs <prisma args>");
  process.exit(1);
}

const prismaBin = process.platform === "win32"
  ? path.join(apiDir, "node_modules", ".bin", "prisma.cmd")
  : path.join(apiDir, "node_modules", ".bin", "prisma");

const result = spawnSync(prismaBin, args, {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
