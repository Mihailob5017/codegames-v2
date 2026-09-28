import { defineConfig } from "drizzle-kit";

// Paths are relative to the api/ directory, which is where the db:* scripts run.
export default defineConfig({
	dialect: "postgresql",
	schema: "./db/schema.ts",
	out: "./db/migrations",
	dbCredentials: {
		url: process.env["DATABASE_URL"]!,
	},
	verbose: true,
	strict: true,
});
