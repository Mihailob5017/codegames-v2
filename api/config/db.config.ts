import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.ts";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
	throw new Error(
		"DATABASE_URL is not set. Inside Docker it is set on the api service in docker-compose.yml.",
	);
}

// Passing `schema` is what turns on the typed relational API (db.query.users).
// drizzle() owns the pool; reach it as db.$client to close it in scripts.
export const db = drizzle(connectionString, { schema });
