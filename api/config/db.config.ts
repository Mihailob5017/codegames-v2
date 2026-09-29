import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.ts";
import { env } from "./env.config.ts";

// Passing `schema` is what turns on the typed relational API (db.query.users).
// drizzle() owns the pool; reach it as db.$client to close it in scripts.
export const db = drizzle(env.DATABASE_URL, { schema });
