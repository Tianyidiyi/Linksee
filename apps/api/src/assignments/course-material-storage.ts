import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { env } from "../infra/env.js";
import { buildBucketPublicUrl, minioClient } from "../infra/minio.js";

export type StoredFileMetadata = {
  name: string;
  objectKey: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

export type PublicStoredFileMetadata = StoredFileMetadata & {
  url: string;
};

const allowedCourseMaterialMimeTypes = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10,
  },
  fileFilter(_req, file, cb) {
    if (allowedCourseMaterialMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported file type"));
  },
});

export function parseCourseMaterialUpload(req: Request, res: Response, next: (err?: unknown) => void): void {
  if (!req.is("multipart/form-data")) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Use multipart/form-data and field name 'files'",
    });
    return;
  }

  upload.array("files", 10)(req, res, (err) => {
    if (err) {
      res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Invalid material files. Only supported document/image types up to 20MB each are allowed",
      });
      return;
    }
    next();
  });
}

function sanitizeFileName(originalName: string): string {
  const safeName = path.basename(originalName).replace(/[^A-Za-z0-9._-]+/g, "_");
  return safeName.length > 0 ? safeName : "file";
}

export function normalizeStoredFiles(value: Prisma.JsonValue | null): StoredFileMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : null;
    const objectKey = typeof record.objectKey === "string" ? record.objectKey : null;
    const size = typeof record.size === "number" ? record.size : null;
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : null;
    const uploadedAt = typeof record.uploadedAt === "string" ? record.uploadedAt : null;

    if (!name || !objectKey || size === null || !mimeType || !uploadedAt) {
      return [];
    }

    return [{ name, objectKey, size, mimeType, uploadedAt }];
  });
}

export function withCourseMaterialUrls(files: StoredFileMetadata[]): PublicStoredFileMetadata[] {
  return files.map((file) => ({
    ...file,
    url: buildBucketPublicUrl(env.minioBucketCourseMaterials, file.objectKey),
  }));
}

type UploadMaterialFileInput = {
  courseId: bigint;
  assignmentId: bigint;
  stageId?: bigint;
  file: Express.Multer.File;
};

export async function uploadCourseMaterialFile(input: UploadMaterialFileInput): Promise<StoredFileMetadata> {
  const prefix = input.stageId
    ? `courses/${input.courseId.toString()}/assignments/${input.assignmentId.toString()}/stages/${input.stageId.toString()}`
    : `courses/${input.courseId.toString()}/assignments/${input.assignmentId.toString()}`;
  const objectKey = `${prefix}/${crypto.randomUUID()}-${sanitizeFileName(input.file.originalname)}`;

  await minioClient.putObject(
    env.minioBucketCourseMaterials,
    objectKey,
    input.file.buffer,
    input.file.size,
    { "Content-Type": input.file.mimetype },
  );

  return {
    name: input.file.originalname,
    objectKey,
    size: input.file.size,
    mimeType: input.file.mimetype,
    uploadedAt: new Date().toISOString(),
  };
}

export async function removeCourseMaterialObject(objectKey: string): Promise<void> {
  await minioClient.removeObject(env.minioBucketCourseMaterials, objectKey).catch(() => {});
}
