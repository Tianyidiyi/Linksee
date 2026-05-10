import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const dockerEnvPath = path.join(repoRoot, "infra", "docker", ".env");

dotenv.config({ path: dockerEnvPath });
dotenv.config();

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: readEnv("DATABASE_URL"),
  redisUrl: readEnv("REDIS_URL"),
  jwtSecret: readEnv("JWT_SECRET"),
  jwtAccessExpiresIn: readEnv("JWT_ACCESS_EXPIRES_IN", "30m"),
  jwtRefreshTtlSeconds: Number(
    readEnv(
      "JWT_REFRESH_TTL_SECONDS",
      String(Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7) * 86400),
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
};
