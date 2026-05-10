import { prisma } from "../infra/prisma.js";
import { minioClient } from "../infra/minio.js";
import { env } from "../infra/env.js";

export async function cleanupExpiredChatFiles(): Promise<number> {
  const prismaChatFile = prisma as typeof prisma & {
    chatFile: {
      findMany: (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<Array<Record<string, unknown>>>;
      deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    };
  };

  const now = new Date();
  const expired = await prismaChatFile.chatFile.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, objectKey: true, thumbnailKey: true },
  });

  if (expired.length === 0) {
    return 0;
  }

  await Promise.all(
    expired.flatMap((file) => {
      const keys = new Set<string>([file.objectKey, file.thumbnailKey ?? ""]);
      keys.delete("");
      return Array.from(keys).map((key) => minioClient.removeObject(env.minioBucketChatFiles, key).catch(() => {}));
    }),
  );

  await prismaChatFile.chatFile.deleteMany({
    where: { id: { in: expired.map((file) => file.id) } },
  });

  return expired.length;
}

if (process.argv[1] && process.argv[1].endsWith("chat-files-cleanup.ts")) {
  cleanupExpiredChatFiles()
    .then((count) => {
      console.log(`[chat-files] cleaned ${count} expired files`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error("[chat-files] cleanup failed", err);
      process.exit(1);
    });
}
