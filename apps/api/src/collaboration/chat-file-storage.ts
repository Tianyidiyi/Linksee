import crypto from "node:crypto";
import path from "node:path";
import { env } from "../infra/env.js";
import { minioClient } from "../infra/minio.js";

export type ChatFileMetadata = {
  name: string;
  objectKey: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  thumbnailKey?: string;
};

export type ChatFileInput = {
  name: string;
  objectKey: string;
  size: number;
  mimeType: string;
  uploadedAt?: string;
};

export const CHAT_FILE_MAX_BYTES = 500 * 1024 * 1024;
export const CHAT_FILE_PRESIGN_TTL_SECONDS = 30 * 60;

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
  "application/xml",
  "text/xml",
  "text/markdown",
  "text/x-yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-tex",
  "application/x-tex",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function sanitizeFileName(originalName: string): string {
  const safeName = path.basename(originalName).replace(/[^A-Za-z0-9._-]+/g, "_");
  return safeName.length > 0 ? safeName : "file";
}

export function isAllowedChatMimeType(mimeType: string): boolean {
  if (allowedMimeTypes.has(mimeType)) {
    return true;
  }
  return mimeType.startsWith("text/");
}

export function ensureChatFileSize(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= CHAT_FILE_MAX_BYTES;
}

export function buildChatObjectKey(scopeType: "course" | "group", scopeId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `chat/${scopeType}/${scopeId}/${crypto.randomUUID()}-${safeName}`;
}

export function isObjectKeyInScope(objectKey: string, scopeType: "course" | "group", scopeId: string): boolean {
  return objectKey.startsWith(`chat/${scopeType}/${scopeId}/`);
}

export async function presignChatUpload(objectKey: string, mimeType: string): Promise<string> {
  return minioClient.presignedPutObject(env.minioBucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS, {
    "Content-Type": mimeType,
  });
}

export async function presignChatDownload(objectKey: string): Promise<string> {
  return minioClient.presignedGetObject(env.minioBucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS);
}

export function normalizeChatFiles(files: unknown): ChatFileInput[] {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : null;
    const objectKey = typeof record.objectKey === "string" ? record.objectKey : null;
    const size = typeof record.size === "number" ? record.size : null;
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : null;
    const uploadedAt = typeof record.uploadedAt === "string" ? record.uploadedAt : undefined;

    if (!name || !objectKey || size === null || !mimeType) {
      return [];
    }

    return [{ name, objectKey, size, mimeType, uploadedAt }];
  });
}

export function toChatFileMetadata(input: ChatFileInput): ChatFileMetadata {
  const thumbnailKey = input.mimeType.startsWith("image/") ? input.objectKey : undefined;
  return {
    name: input.name,
    objectKey: input.objectKey,
    size: input.size,
    mimeType: input.mimeType,
    uploadedAt: input.uploadedAt ?? new Date().toISOString(),
    thumbnailKey,
  };
}
