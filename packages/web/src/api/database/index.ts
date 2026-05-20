import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

// Enable foreign key enforcement
await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, { schema });

// Auto-migrate on startup when migrations folder exists
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} catch {
  // No migrations folder yet (dev without generated migrations) — skip silently
}
