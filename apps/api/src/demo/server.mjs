import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import selfsigned from "selfsigned";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const useHttps = (process.env.DEMO_HTTPS ?? "true").toLowerCase() === "true";
const port = Number(process.env.DEMO_PORT ?? (useHttps ? 3443 : 3000));
const host = process.env.DEMO_HOST ?? "0.0.0.0";

const webDemoDir = path.resolve(__dirname, "../../../web/demo");
app.use(express.static(webDemoDir));
app.get("/health", (_req, res) => {
  res.json({ ok: true, https: useHttps, now: new Date().toISOString() });
});

let server;
if (useHttps) {
  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = selfsigned.generate(attrs, { days: 7 });
  server = https.createServer({ key: pems.private, cert: pems.cert }, app);
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: false,
  },
});

const HEARTBEAT_INTERVAL_MS = Number(process.env.DEMO_HEARTBEAT_INTERVAL_MS ?? 10000);
const HEARTBEAT_TIMEOUT_MS = Number(process.env.DEMO_HEARTBEAT_TIMEOUT_MS ?? 30000);

io.on("connection", (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const online = token === "demo-token";
  let lastHeartbeatAt = Date.now();

  const buildPresence = (reason) => ({
    status: online ? "online" : "offline",
    reason,
    ts: new Date().toISOString(),
  });

  socket.emit("heartbeat:config", {
    intervalMs: HEARTBEAT_INTERVAL_MS,
    timeoutMs: HEARTBEAT_TIMEOUT_MS,
    ts: new Date().toISOString(),
  });

  socket.emit("presence", buildPresence(online ? "authenticated" : "missing_or_invalid_token"));

  socket.on("presence:check", () => {
    socket.emit("presence", buildPresence(online ? "authenticated" : "missing_or_invalid_token"));
  });

  socket.on("heartbeat:ping", (payload) => {
    lastHeartbeatAt = Date.now();
    const now = Date.now();
    const receivedAtIso = new Date(now).toISOString();
    const sentAt = Number(payload?.sentAt);
    const rttMs = Number.isFinite(sentAt) ? Math.max(0, now - sentAt) : null;

    socket.emit("heartbeat:pong", {
      seq: payload?.seq ?? null,
      serverTs: receivedAtIso,
      serverReceiveTs: receivedAtIso,
      serverSendTs: new Date().toISOString(),
      clientSentAtMs: Number.isFinite(sentAt) ? sentAt : null,
      clientTs: payload?.clientTs ?? null,
      rttMs,
    });

    console.log(
      `[demo][heartbeat] ts=${receivedAtIso} socket=${socket.id} seq=${payload?.seq ?? "n/a"} rttMs=${rttMs ?? "n/a"}`,
    );
  });

  const heartbeatGuard = setInterval(() => {
    if (Date.now() - lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
      socket.emit("presence", {
        status: "offline",
        reason: "heartbeat_timeout",
        ts: new Date().toISOString(),
      });
      socket.disconnect(true);
    }
  }, Math.max(1000, Math.floor(HEARTBEAT_TIMEOUT_MS / 3)));

  socket.on("disconnect", (reason) => {
    clearInterval(heartbeatGuard);
    console.log(`[demo] socket disconnected: ${socket.id}, reason=${reason}`);
  });
});

server.listen(port, host, () => {
  const protocol = useHttps ? "https" : "http";
  console.log(`[demo] server running: ${protocol}://localhost:${port}`);
  console.log("[demo] login page: /login.html");
  console.log("[demo] status page: /status.html");
  console.log("[demo] note: token is demo-token");
  console.log(
    `[demo] heartbeat config: interval=${HEARTBEAT_INTERVAL_MS}ms timeout=${HEARTBEAT_TIMEOUT_MS}ms`,
  );
});
