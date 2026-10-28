import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Secrets live in .env.local (gitignored); .env is intentionally absent.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate / studio / db execute) must use the SESSION-mode pooler
    // on port 5432. The transaction-mode pooler on 6543 reuses connections and
    // rejects Prisma's prepared statements with
    //   ERROR: prepared statement "s1" already exists
    //
    // Application runtime is a separate concern: src/lib/db.ts builds its own
    // driver adapter from DATABASE_URL (the 6543 pooler), which is the right
    // choice for short-lived serverless queries.
    url: env("DIRECT_URL"),
  },
});
