import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../apps/api/src/infra/env.js";
import {
  buildBucketPublicUrl,
  buildPublicUrl,
  ensureBuckets,
  extractBucketObjectName,
  extractObjectName,
  minioClient,
} from "../../../apps/api/src/infra/minio.js";

describe("infra/minio", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("buildBucketPublicUrl/buildPublicUrl should compose expected URL", () => {
    const prev = env.minioUseSsl;
    env.minioUseSsl = false;
    const u1 = buildBucketPublicUrl("bucket-a", "a/b.txt");
    expect(u1).toContain(`/bucket-a/a/b.txt`);
    expect(u1.startsWith("http://")).toBe(true);
    env.minioUseSsl = true;
    const uHttps = buildBucketPublicUrl("bucket-a", "a/b.txt");
    expect(uHttps.startsWith("https://")).toBe(true);
    env.minioUseSsl = prev;
    const u2 = buildPublicUrl("avatar.png");
    expect(u2).toContain(`/${env.minioBucketAvatars}/avatar.png`);
  });

  it("extractBucketObjectName/extractObjectName should parse valid url", () => {
    const url = buildBucketPublicUrl(env.minioBucketAvatars, "x/y/z.jpg");
    expect(extractBucketObjectName(url, env.minioBucketAvatars)).toBe("x/y/z.jpg");
    expect(extractObjectName(url)).toBe("x/y/z.jpg");
  });

  it("extractBucketObjectName should return null for invalid or mismatched url", () => {
    expect(extractBucketObjectName("not-a-url", env.minioBucketAvatars)).toBeNull();
    const other = buildBucketPublicUrl("other", "file.txt");
    expect(extractBucketObjectName(other, env.minioBucketAvatars)).toBeNull();
  });

  it("ensureBuckets should create missing buckets and apply policy only for public buckets", async () => {
    const bucketExists = jest.spyOn(minioClient, "bucketExists");
    const makeBucket = jest.spyOn(minioClient, "makeBucket").mockResolvedValue(undefined as any);
    const setPolicy = jest.spyOn(minioClient, "setBucketPolicy").mockResolvedValue(undefined as any);

    bucketExists.mockResolvedValueOnce(false as any);
    bucketExists.mockResolvedValueOnce(false as any);
    bucketExists.mockResolvedValueOnce(false as any);

    await ensureBuckets();
    expect(makeBucket).toHaveBeenCalledTimes(3);
    expect(setPolicy).toHaveBeenCalledTimes(2);
  });

  it("ensureBuckets should skip makeBucket when already exists", async () => {
    const bucketExists = jest.spyOn(minioClient, "bucketExists").mockResolvedValue(true as any);
    const makeBucket = jest.spyOn(minioClient, "makeBucket").mockResolvedValue(undefined as any);
    const setPolicy = jest.spyOn(minioClient, "setBucketPolicy").mockResolvedValue(undefined as any);
    await ensureBuckets();
    expect(bucketExists).toHaveBeenCalled();
    expect(makeBucket).not.toHaveBeenCalled();
    expect(setPolicy).toHaveBeenCalledTimes(2);
  });
});
