import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Runtime queries go through the TRANSACTION-mode pooler (port 6543) from
// DATABASE_URL. Migrations use the session-mode pooler via prisma.config.ts —
// see the comment there for why the two differ.
const connectionString = process.env.DATABASE_URL;

function createClient() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy the Supabase pooler connection string into .env.local.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js dev server hot-reloads modules; without this each reload would open
// a new pool and exhaust the pooler's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/** True when a database connection string is configured at all. */
export const isDatabaseConfigured = Boolean(connectionString);

/**
 * True when `error` is Prisma's unique-constraint failure (P2002) on `field`.
 *
 * The error class is not imported: with a driver adapter the thrown object is
 * matched on its `code`, which is stable, and `meta.target` names the columns
 * (sometimes the constraint) that collided. Checking the field matters —
 * "email already taken" and "that workspace slug is taken" need very different
 * answers.
 */
export function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;

  const target = meta?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return text.toLowerCase().includes(field.toLowerCase());
}
