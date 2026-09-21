import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// A single pooled connection reused across hot-reloads in dev and across
// invocations in serverless (Vercel keeps warm lambdas around between
// requests, so a module-level pool avoids opening a new connection per call).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase's pooled connection endpoint terminates TLS; this keeps local
    // Postgres (no TLS) working too.
    ssl: process.env.DATABASE_URL?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
