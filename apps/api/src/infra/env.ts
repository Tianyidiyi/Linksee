import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

function resolveDockerEnvPath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "infra", "docker", ".env"),
    path.join(cwd, "..", "..", "infra", "docker", ".env"),
    path.join(cwd, "..", "..", "..", "infra", "docker", ".env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  return path.resolve(candidates[0]);
}

const dockerEnvPath = resolveDockerEnvPath();

dotenv.config({ path: dockerEnvPath });
dotenv.config();

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function resolveRefreshTtlFallbackSeconds(): string {
  const refreshDaysRaw = process.env.JWT_REFRESH_EXPIRES_DAYS;
  if (refreshDaysRaw === undefined || refreshDaysRaw === "") {
    return String(7 * 86400);
  }
  return String(Number(refreshDaysRaw) * 86400);
}

export const env = {
  databaseUrl: readEnv("DATABASE_URL"),
  redisUrl: readEnv("REDIS_URL"),
  jwtSecret: readEnv("JWT_SECRET"),
  jwtAccessExpiresIn: readEnv("JWT_ACCESS_EXPIRES_IN", "30m"),
  jwtRefreshTtlSeconds: Number(
    readEnv(
      "JWT_REFRESH_TTL_SECONDS",
      resolveRefreshTtlFallbackSeconds(),
    ),
  ),
  authPort: Number(readEnv("AUTH_PORT", "3001")),
  defaultAvatarUrl: readEnv("DEFAULT_AVATAR_URL", "http://localhost:3001/demo/default-avatar-gray.svg"),
  // MinIO / S3 对象存储
  minioEndpoint: readEnv("MINIO_ENDPOINT", "localhost"),
  minioPort: Number(readEnv("MINIO_PORT", "9000")),
  minioUseSsl: readEnv("MINIO_USE_SSL", "false") === "true",
  minioAccessKey: readEnv("MINIO_ACCESS_KEY"),
  minioSecretKey: readEnv("MINIO_SECRET_KEY"),
  minioBucketAvatars: readEnv("MINIO_BUCKET_AVATARS", "avatars"),
  minioBucketCourseMaterials: readEnv("MINIO_BUCKET_COURSE_MATERIALS", "course-materials"),
  minioBucketChatFiles: readEnv("MINIO_BUCKET_CHAT_FILES", "chat-files"),
  minioBucketSubmissionFiles: readEnv("MINIO_BUCKET_SUBMISSION_FILES", "submission-files"),
};
