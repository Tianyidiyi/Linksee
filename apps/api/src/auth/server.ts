import "dotenv/config";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./auth-router.js";
import { usersRouter } from "../users/users-router.js";
import { assignmentsRouter } from "../assignments/assignments-router.js";
import { assignmentStagesRouter } from "../assignments/assignment-stages-router.js";
import { coursesRouter } from "../courses/courses-router.js";
import { courseMembersRouter } from "../courses/course-members-router.js";
import { groupsRouter } from "../groups/groups-router.js";
import { courseChatRouter } from "../collaboration/course-chat-router.js";
import { groupChatRouter } from "../collaboration/group-chat-router.js";
import { chatFilesRouter } from "../collaboration/chat-files-router.js";
import { conversationsRouter } from "../collaboration/conversations-router.js";
import { realtimeRouter } from "../collaboration/realtime-router.js";
import { optionalAuth, forceChangeGuard } from "../infra/jwt-middleware.js";
import { ensureBuckets } from "../infra/minio.js";
import { env } from "../infra/env.js";
import { prisma } from "../infra/prisma.js";
import { setupRealtimeGateway } from "../socket/gateway.js";
import { registerRealtimeGateway } from "../events/realtime-publisher.js";

const app = express();
app.use(express.json());
app.use(optionalAuth);      // 有 token 就解析挂 req.user，无 token 跳过
app.use(forceChangeGuard);  // forceChangePassword=true 时拦截所有非改密接口

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
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/courses", coursesRouter);
app.use("/api/v1/courses", courseMembersRouter);
app.use("/api/v1", assignmentsRouter);
app.use("/api/v1", assignmentStagesRouter);
app.use("/api/v1", groupsRouter);
app.use("/api/v1", courseChatRouter);
app.use("/api/v1", groupChatRouter);
app.use("/api/v1", chatFilesRouter);
app.use("/api/v1", conversationsRouter);
app.use("/api/v1", realtimeRouter);

async function bootstrap(): Promise<void> {
  await ensureBuckets();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: false,
    },
  });

  const gateway = setupRealtimeGateway(io, {
    authenticate: async (token: string) => {
      const payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
      const userId = payload.sub;
      const role = payload.role;

      let courseIds: bigint[] = [];
      if (role === "academic") {
        const courses = await prisma.course.findMany({ select: { id: true } });
        courseIds = courses.map((course) => course.id);
      } else if (role === "teacher") {
        const rows = await prisma.courseTeacher.findMany({ where: { userId }, select: { courseId: true } });
        courseIds = rows.map((row) => row.courseId);
      } else if (role === "assistant") {
        const rows = await prisma.assistantBinding.findMany({ where: { assistantUserId: userId }, select: { courseId: true } });
        courseIds = rows.map((row) => row.courseId);
      } else {
        const rows = await prisma.courseMember.findMany({
          where: { userId, status: "active" },
          select: { courseId: true },
        });
        courseIds = rows.map((row) => row.courseId);
      }

      const groupIds = role === "student"
        ? (await prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } })).map((row) => row.groupId)
        : [];

      return {
        userId,
        courseIds: courseIds.map((id) => id.toString()),
        groupIds: groupIds.map((id) => id.toString()),
      };
    },
  });

  registerRealtimeGateway(gateway);

  server.listen(env.authPort, () => {
    console.log(`[auth-api] listening on http://localhost:${env.authPort}`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error("[auth-api] startup failed", err);
  process.exit(1);
});
