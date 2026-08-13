import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.database_url;

// Serverless-friendly pool: one connection per warm instance so many
// concurrent invocations can't exhaust the database's connection limit.
// Local/VM runs are unaffected (a single process uses one connection anyway).
const adapter = new PrismaPg({ connectionString, max: 1 });
const prisma = new PrismaClient({ adapter });

export { prisma };
