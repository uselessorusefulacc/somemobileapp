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

// Enable foreign key enforcement.
// For pooled connections (libsql://), PRAGMA must be set per-connection.
// We wrap client.execute so every connection gets the PRAGMA.
const _exec = client.execute.bind(client);
client.execute = ((sql, params) => {
  return _exec("PRAGMA foreign_keys = ON").then(() => _exec(sql, params));
}) as typeof client.execute;

await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, { schema });

// Auto-migrate on startup when migrations folder exists
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} catch (e) {
  console.warn("[DB] Migration skipped (no drizzle folder yet):", e instanceof Error ? e.message : e);
}
