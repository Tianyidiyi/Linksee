import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./auth-router.js";
import { usersRouter } from "../users/users-router.js";
import { optionalAuth, forceChangeGuard } from "../infra/jwt-middleware.js";
import { ensureBuckets } from "../infra/minio.js";
import { env } from "../infra/env.js";

const app = express();
app.use(express.json());
app.use(optionalAuth);      // 有 token 就解析挂 req.user，无 token 跳过
app.use(forceChangeGuard);  // forceChangePassword=true 时拦截所有非改密接口

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDemoDir = path.resolve(__dirname, "../../../web/demo");
app.use("/demo", express.static(webDemoDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth-api", now: new Date().toISOString() });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);

async function bootstrap(): Promise<void> {
  await ensureBuckets();
  app.listen(env.authPort, () => {
    console.log(`[auth-api] listening on http://localhost:${env.authPort}`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error("[auth-api] startup failed", err);
  process.exit(1);
});
