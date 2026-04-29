import "dotenv/config";

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
  jwtRefreshTtlSeconds: Number(readEnv("JWT_REFRESH_TTL_SECONDS", "604800")),
  authPort: Number(readEnv("AUTH_PORT", "3001")),
};
