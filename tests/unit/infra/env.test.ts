import { describe, expect, it, jest } from "@jest/globals";

describe("infra/env", () => {
  it("should throw when required env is missing", async () => {
    const oldEnv = process.env;
    process.env = {
      ...oldEnv,
      DATABASE_URL: "",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret",
      MINIO_ACCESS_KEY: "ak",
      MINIO_SECRET_KEY: "sk",
    };

    jest.resetModules();
    await expect(import("../../../apps/api/src/infra/env.js")).rejects.toThrow("Missing required env: DATABASE_URL");
    process.env = oldEnv;
  });
});
