import type { Request, Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { env } from "../infra/env.js";
import { minioClient } from "../infra/minio.js";

export type SubmissionFileMetadata = {
  name: string;
  objectKey: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

const allowedSubmissionMimeTypes = new Set([
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
    files: 20,
  },
  fileFilter(_req, file, cb) {
    if (allowedSubmissionMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported file type"));
  },
});

export function parseSubmissionFileUpload(req: Request, res: Response, next: (err?: unknown) => void): void {
  if (!req.is("multipart/form-data")) {
    next();
    return;
  }

  upload.array("files", 20)(req, res, (err) => {
    if (err) {
      res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Invalid submission files. Only supported document/image types up to 20MB each are allowed",
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

type UploadSubmissionFileInput = {
  courseId: bigint;
  assignmentId: bigint;
  stageId: bigint;
  groupId: bigint;
  file: Express.Multer.File;
};

export async function uploadSubmissionFile(input: UploadSubmissionFileInput): Promise<SubmissionFileMetadata> {
  const prefix = `submissions/courses/${input.courseId.toString()}/assignments/${input.assignmentId.toString()}/stages/${input.stageId.toString()}/groups/${input.groupId.toString()}`;
  const objectKey = `${prefix}/${crypto.randomUUID()}-${sanitizeFileName(input.file.originalname)}`;

  await minioClient.putObject(
    env.minioBucketSubmissionFiles,
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

export async function removeSubmissionFileObject(objectKey: string): Promise<void> {
  await minioClient.removeObject(env.minioBucketSubmissionFiles, objectKey).catch(() => {});
}
