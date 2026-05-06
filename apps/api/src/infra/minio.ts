import { Client } from "minio";
import { env } from "./env.js";

/** MinIO 客户端单例（S3 兼容，对应 docker-compose 中的 minio 服务，端口 9000） */
export const minioClient = new Client({
  endPoint: env.minioEndpoint,
  port: env.minioPort,
  useSSL: env.minioUseSsl,
  accessKey: env.minioAccessKey,
  secretKey: env.minioSecretKey,
});

/**
 * 确保 bucket 存在并设置公开读策略。
 * 服务启动时调用一次，幂等操作。
 */
export async function ensureBuckets(): Promise<void> {
  const bucket = env.minioBucketAvatars;
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, "");
    console.log(`[minio] bucket "${bucket}" created`);
  }
  // 设置公开读策略（s3:GetObject 对所有人开放）
  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
  await minioClient.setBucketPolicy(bucket, policy);
}

/** 构造头像公开访问 URL（不过期，依赖 bucket 公开读策略） */
export function buildPublicUrl(objectName: string): string {
  const protocol = env.minioUseSsl ? "https" : "http";
  return `${protocol}://${env.minioEndpoint}:${env.minioPort}/${env.minioBucketAvatars}/${objectName}`;
}

/**
 * 从公开 URL 中提取 objectName。
 * URL 格式：http://host:port/bucket/objectName
 */
export function extractObjectName(publicUrl: string): string | null {
  try {
    const pathname = new URL(publicUrl).pathname; // /avatars/userId/uuid.jpg
    const prefix = `/${env.minioBucketAvatars}/`;
    if (!pathname.startsWith(prefix)) return null;
    return pathname.slice(prefix.length);
  } catch {
    return null;
  }
}

