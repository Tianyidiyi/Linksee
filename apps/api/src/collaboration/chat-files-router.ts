import { Router, type Request, type Response } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../infra/jwt-middleware.js";
import { ensureCourseReadable } from "../courses/course-access.js";
import { getGroupAccess } from "../groups/group-access.js";
import {
  buildChatObjectKey,
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  isAllowedChatMimeType,
  isObjectKeyInScope,
  presignChatDownload,
  presignChatUpload,
} from "./chat-file-storage.js";

export const chatFilesRouter = Router();

function validationFailed(res: Response, message: string): void {
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message });
}

function parseScope(rawType: unknown, rawId: unknown, res: Response): { scopeType: "course" | "group"; scopeId: string } | null {
  if (rawType !== "course" && rawType !== "group") {
    validationFailed(res, "scopeType must be course or group");
    return null;
  }
  if (typeof rawId !== "string" || !/^[0-9]+$/.test(rawId)) {
    validationFailed(res, "scopeId must be a positive integer string");
    return null;
  }
  return { scopeType: rawType, scopeId: rawId };
}

async function ensureScopeReadable(
  scopeType: "course" | "group",
  scopeId: string,
  req: Request,
  res: Response,
): Promise<boolean> {
  if (scopeType === "course") {
    const courseId = BigInt(scopeId);
    return !!(await ensureCourseReadable(courseId, req.user!.id, req.user!.role as Role, res));
  }

  const groupId = BigInt(scopeId);
  return !!(await getGroupAccess(groupId, req.user!.id, req.user!.role as Role, res));
}

function parseScopeFromObjectKey(objectKey: string): { scopeType: "course" | "group"; scopeId: string } | null {
  const segments = objectKey.split("/");
  if (segments.length < 3) {
    return null;
  }
  if (segments[0] !== "chat") {
    return null;
  }
  const scopeType = segments[1];
  const scopeId = segments[2];
  if ((scopeType !== "course" && scopeType !== "group") || !/^[0-9]+$/.test(scopeId)) {
    return null;
  }
  return { scopeType, scopeId } as { scopeType: "course" | "group"; scopeId: string };
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/chat/files/presign-upload
// ──────────────────────────────────────────────────────────────
chatFilesRouter.post("/chat/files/presign-upload", requireAuth, async (req: Request, res: Response) => {
  const scope = parseScope(req.body?.scopeType, req.body?.scopeId, res);
  if (!scope) return;

  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";
  const size = typeof req.body?.size === "number" ? req.body.size : NaN;

  if (!fileName.trim()) {
    return validationFailed(res, "fileName is required");
  }
  if (!mimeType || !isAllowedChatMimeType(mimeType)) {
    return validationFailed(res, "mimeType is not allowed");
  }
  if (!Number.isFinite(size) || size <= 0 || size > CHAT_FILE_MAX_BYTES) {
    return validationFailed(res, `file size must be <= ${CHAT_FILE_MAX_BYTES} bytes`);
  }

  const readable = await ensureScopeReadable(scope.scopeType, scope.scopeId, req, res);
  if (!readable) return;

  const objectKey = buildChatObjectKey(scope.scopeType, scope.scopeId, fileName);
  const uploadUrl = await presignChatUpload(objectKey, mimeType);

  res.status(201).json({
    ok: true,
    data: {
      objectKey,
      uploadUrl,
      expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
      headers: {
        "Content-Type": mimeType,
      },
    },
  });
});

// ──────────────────────────────────────────────────────────────
// GET /api/v1/chat/files/presign-download
// ──────────────────────────────────────────────────────────────
chatFilesRouter.get("/chat/files/presign-download", requireAuth, async (req: Request, res: Response) => {
  const objectKey = typeof req.query.objectKey === "string" ? req.query.objectKey : "";
  if (!objectKey) {
    return validationFailed(res, "objectKey is required");
  }

  const scope = parseScopeFromObjectKey(objectKey);
  if (!scope || !isObjectKeyInScope(objectKey, scope.scopeType, scope.scopeId)) {
    return validationFailed(res, "objectKey is invalid");
  }

  const readable = await ensureScopeReadable(scope.scopeType, scope.scopeId, req, res);
  if (!readable) return;

  const downloadUrl = await presignChatDownload(objectKey);

  res.json({
    ok: true,
    data: {
      objectKey,
      downloadUrl,
      expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
    },
  });
});
