import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 config. `.env` is loaded via `dotenv/config` above (Prisma no longer
// auto-loads it). The datasource URL lives here rather than in schema.prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
