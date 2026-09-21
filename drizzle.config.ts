import type { Config } from "drizzle-kit";

// Loaded at CLI-time by drizzle-kit; not bundled into the app.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
} satisfies Config;
