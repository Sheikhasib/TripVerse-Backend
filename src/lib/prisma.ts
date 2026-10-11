import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.database_url;

// Serverless-friendly pool: one connection per warm instance on Vercel so many
// concurrent invocations can't exhaust the database's connection limit.
// Long-running servers get 10 — with 1, requests and transactions would queue.
const adapter = new PrismaPg({
  connectionString,
  max: config.is_vercel ? 1 : 10,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
