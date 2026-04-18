import { io } from "socket.io-client";

const url = process.env.DEMO_URL ?? "https://localhost:3443";
const token = process.env.DEMO_TOKEN ?? "demo-token";

const socket = io(url, {
  auth: { token },
  rejectUnauthorized: false,
  transports: ["websocket", "polling"],
});

let gotPresenceOnline = false;
let gotHeartbeatPong = false;

function finishIfReady() {
  if (!gotPresenceOnline || !gotHeartbeatPong) {
    return;
  }

  clearTimeout(timeout);
  socket.disconnect();
  process.exit(0);
}

const timeout = setTimeout(() => {
  console.error("[socket-smoke] timeout: missing presence or heartbeat event");
  socket.disconnect();
  process.exit(1);
}, 7000);

socket.on("presence", (payload) => {
  console.log("[socket-smoke] presence:", JSON.stringify(payload));
  if (payload?.status === "online") {
    gotPresenceOnline = true;
    finishIfReady();
    return;
  }
  process.exit(2);
});

socket.on("heartbeat:pong", (payload) => {
  console.log("[socket-smoke] heartbeat:", JSON.stringify(payload));
  if (!payload?.serverSendTs || !payload?.serverReceiveTs) {
    console.error("[socket-smoke] invalid heartbeat payload: missing timestamp fields");
    process.exit(3);
  }
  gotHeartbeatPong = true;
  finishIfReady();
});

socket.on("connect", () => {
  socket.emit("presence:check");
  socket.emit("heartbeat:ping", {
    seq: 1,
    sentAt: Date.now(),
    clientTs: new Date().toISOString(),
  });
});

socket.on("connect_error", (err) => {
  clearTimeout(timeout);
  console.error("[socket-smoke] connect_error:", err.message);
  process.exit(1);
});
