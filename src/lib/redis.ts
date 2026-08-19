import { createClient } from "redis";
import type { RedisClientType } from "redis";
import config from "../config";

// Redis OTP store for email verification + password reset (Step 21) — mirrors
// the reference backend's node-redis client. Null when unconfigured so the app
// still boots (e.g. Vercel prod); the auth endpoints then fail with a clean
// 503 instead of crashing.
export const redisClient = config.redis_host
  ? createClient({
      username: config.redis_user,
      password: config.redis_password,
      socket: {
        host: config.redis_host,
        port: parseInt(config.redis_port || "6379"),
      },
    })
  : null;

// Lazily-connect accessor — connect() is idempotent, so this is safe to call
// per request; the client is also connected once at boot in server.ts.
export const getRedis = async (): Promise<RedisClientType | null> => {
  if (!redisClient) return null;

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error(
        "[redis] connect failed:",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  return redisClient;
};
