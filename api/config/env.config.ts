import z from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	DATABASE_URL: z.url(),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Parsed once at import time, so every entry point (server, seed, scripts)
// shares the same validated config and fails fast on a bad .env.
export const env: EnvConfig = envSchema.parse(process.env);
