import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Multi-file schema lives under prisma/schema/ (one model file per model)
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
