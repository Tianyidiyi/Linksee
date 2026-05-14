import { describe, expect, it, jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

  it("should apply defaults and parse MINIO_USE_SSL true", async () => {
    const oldEnv = process.env;
    process.env = {
      ...oldEnv,
      DATABASE_URL: "mysql://u:p@localhost:3306/db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret",
      MINIO_ACCESS_KEY: "ak",
      MINIO_SECRET_KEY: "sk",
      MINIO_USE_SSL: "true",
      JWT_REFRESH_EXPIRES_DAYS: "10",
    };
    delete process.env.JWT_REFRESH_TTL_SECONDS;

    jest.resetModules();
    const mod = await import("../../../apps/api/src/infra/env.js");
    expect(mod.env.jwtAccessExpiresIn).toBe("30m");
    expect(mod.env.minioUseSsl).toBe(true);
    expect(typeof mod.env.jwtRefreshTtlSeconds).toBe("number");
    expect(mod.env.jwtRefreshTtlSeconds).toBeGreaterThan(0);
    process.env = oldEnv;
  });

  it("should fallback to default docker env candidate when no env file exists", async () => {
    const oldEnv = process.env;
    const oldCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linksee-env-"));
    process.env = {
      ...oldEnv,
      DATABASE_URL: "mysql://u:p@localhost:3306/db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret",
      MINIO_ACCESS_KEY: "ak",
      MINIO_SECRET_KEY: "sk",
      JWT_REFRESH_TTL_SECONDS: "604800",
    };

    jest.resetModules();
    process.chdir(tempDir);

    const mod = await import("../../../apps/api/src/infra/env.js");
    expect(mod.env.databaseUrl).toBe("mysql://u:p@localhost:3306/db");

    process.chdir(oldCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = oldEnv;
  });

  it("should fallback JWT_REFRESH_EXPIRES_DAYS to 7 when not provided", async () => {
    const oldEnv = process.env;
    process.env = {
      ...oldEnv,
      DATABASE_URL: "mysql://u:p@localhost:3306/db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret",
      MINIO_ACCESS_KEY: "ak",
      MINIO_SECRET_KEY: "sk",
    };
    delete process.env.JWT_REFRESH_TTL_SECONDS;
    delete process.env.JWT_REFRESH_EXPIRES_DAYS;

    jest.resetModules();
    const mod = await import("../../../apps/api/src/infra/env.js");
    expect(mod.env.jwtRefreshTtlSeconds).toBe(604800);
    process.env = oldEnv;
  });

  it("should use fallback 7 when JWT_REFRESH_EXPIRES_DAYS is empty string", async () => {
    const oldEnv = process.env;
    process.env = {
      ...oldEnv,
      DATABASE_URL: "mysql://u:p@localhost:3306/db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret",
      MINIO_ACCESS_KEY: "ak",
      MINIO_SECRET_KEY: "sk",
      JWT_REFRESH_EXPIRES_DAYS: "",
    };
    delete process.env.JWT_REFRESH_TTL_SECONDS;

    jest.resetModules();
    const mod = await import("../../../apps/api/src/infra/env.js");
    expect(mod.env.jwtRefreshTtlSeconds).toBe(604800);
    process.env = oldEnv;
  });

});
