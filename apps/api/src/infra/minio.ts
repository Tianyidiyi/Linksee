import { Client } from "minio";
import { env } from "./env.js";

export const minioClient = new Client({
  endPoint: env.minioEndpoint,
  port: env.minioPort,
  useSSL: env.minioUseSsl,
  accessKey: env.minioAccessKey,
  secretKey: env.minioSecretKey,
});

async function ensureBucketReady(bucket: string, publicRead: boolean): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, "");
    console.log(`[minio] bucket "${bucket}" created`);
  }

  if (!publicRead) {
    return;
  }

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

export async function ensureBuckets(): Promise<void> {
  await ensureBucketReady(env.minioBucketAvatars, true);
  await ensureBucketReady(env.minioBucketCourseMaterials, true);
  await ensureBucketReady(env.minioBucketChatFiles, false);
  await ensureBucketReady(env.minioBucketSubmissionFiles, false);
}

export function buildBucketPublicUrl(bucket: string, objectName: string): string {
  const protocol = env.minioUseSsl ? "https" : "http";
  return `${protocol}://${env.minioEndpoint}:${env.minioPort}/${bucket}/${objectName}`;
}

export function extractBucketObjectName(publicUrl: string, bucket: string): string | null {
  try {
    const pathname = new URL(publicUrl).pathname;
    const prefix = `/${bucket}/`;
    if (!pathname.startsWith(prefix)) return null;
    return pathname.slice(prefix.length);
  } catch {
    return null;
  }
}

export function buildPublicUrl(objectName: string): string {
  return buildBucketPublicUrl(env.minioBucketAvatars, objectName);
}

export function extractObjectName(publicUrl: string): string | null {
  return extractBucketObjectName(publicUrl, env.minioBucketAvatars);
}
