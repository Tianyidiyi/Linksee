import { afterAll } from "@jest/globals";
import { prisma } from "../apps/api/src/infra/prisma.js";
import { redis } from "../apps/api/src/infra/redis.js";

afterAll(async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore teardown errors
  }

  try {
    await redis.quit();
  } catch {
    // ignore teardown errors
  }

  try {
    redis.disconnect();
  } catch {
    // ignore teardown errors
  }
});
