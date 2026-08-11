import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  quiet: true,
  path: path.join(process.cwd(), ".env"),
});

// Every module reads config through this validated object, never
// process.env directly — a missing/malformed var fails loudly at boot
// instead of surfacing as a confusing runtime error mid-request.
const envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),

  FRONTEND_URL_DEV: z.string().url(),
  FRONTEND_URL_PROD: z.string().url(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  BCRYPT_SALT_ROUNDS: z.string().default("10"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

const config = {
  port: env.PORT,
  node_env: env.NODE_ENV,

  frontend_url_dev: env.FRONTEND_URL_DEV,
  frontend_url_prod: env.FRONTEND_URL_PROD,

  database_url: env.DATABASE_URL,

  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,

  jwt_access_secret: env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,

  cloudinary_cloud_name: env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: env.CLOUDINARY_API_SECRET,
};

export default config;
