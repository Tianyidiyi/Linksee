import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./auth-router.js";
import { env } from "../infra/env.js";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAppDir = path.resolve(__dirname, "../../../web/app");
const webDemoDir = path.resolve(__dirname, "../../../web/demo");
app.use("/app", express.static(webAppDir));
app.use("/demo", express.static(webDemoDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth-api", now: new Date().toISOString() });
});

app.use("/api/v1/auth", authRouter);

app.listen(env.authPort, () => {
  console.log(`[auth-api] listening on http://localhost:${env.authPort}`);
});
