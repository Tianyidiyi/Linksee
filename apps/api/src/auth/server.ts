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
import { groupDetailsRouter } from "../groups/group-details-router.js";
import { groupMembersRouter } from "../groups/group-members-router.js";
import { groupRequestsRouter } from "../groups/group-requests-router.js";
import { groupAdminRouter } from "../groups/group-admin-router.js";
import { minitasksRouter } from "../minitasks/minitasks-router.js";
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
import { fail } from "../infra/http-response.js";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use(forceChangeGuard);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const webAppDir = path.resolve(__dirname, "../../../web/app");
  const webDemoDir = path.resolve(__dirname, "../../../web/demo");
  app.use("/app", express.static(webAppDir));
  app.use("/demo", express.static(webDemoDir));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "auth-api", now: new Date().toISOString() });
  });

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") ?? cryptoRandomId();
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/courses", courseMembersRouter);
  app.use("/api/v1", assignmentsRouter);
  app.use("/api/v1", assignmentStagesRouter);
  app.use("/api/v1", groupsRouter);
  app.use("/api/v1", groupDetailsRouter);
  app.use("/api/v1", groupMembersRouter);
  app.use("/api/v1", groupRequestsRouter);
  app.use("/api/v1", groupAdminRouter);
  app.use("/api/v1", minitasksRouter);
  app.use("/api/v1", courseChatRouter);
  app.use("/api/v1", groupChatRouter);
  app.use("/api/v1", chatFilesRouter);
  app.use("/api/v1", conversationsRouter);
  app.use("/api/v1", realtimeRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[http] unhandled error", err);
    fail(res, 500, "INTERNAL_ERROR", "Unexpected server error");
  });

  return app;
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function createHttpServer(app = createApp()): http.Server {
  return http.createServer(app);
}

export async function bootstrap(): Promise<void> {
  await ensureBuckets();
  const server = createHttpServer(createApp());
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

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((err: unknown) => {
    console.error("[auth-api] startup failed", err);
    process.exit(1);
  });
}
