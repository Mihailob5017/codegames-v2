import z from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	DATABASE_URL: z.url(),

	RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
	RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
	// How many reverse proxies sit in front of the API. 0 means req.ip is the
	// socket address and X-Forwarded-For is ignored, so it cannot be spoofed.
	TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Parsed once at import time, so every entry point (server, seed, scripts)
// shares the same validated config and fails fast on a bad .env.
export const env: EnvConfig = envSchema.parse(process.env);
