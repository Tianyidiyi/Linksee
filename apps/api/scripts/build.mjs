import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const artifact = {
  app: "api",
  builtAt: new Date().toISOString(),
  notes: "MVP communication framework scaffold build artifact"
};

writeFileSync(resolve(dist, "BUILD_INFO.json"), JSON.stringify(artifact, null, 2), "utf-8");
console.log("[api] build done -> dist/BUILD_INFO.json");
