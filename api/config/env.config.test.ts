import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const VALID_DATABASE_URL = "postgresql://user:pass@localhost:5433/codegames";

// env.config parses process.env at import time, so each test needs a fresh module.
const loadEnv = async () => {
	vi.resetModules();
	const { env } = await import("./env.config.ts");
	return env;
};

describe("env config", () => {
	beforeEach(() => {
		vi.stubEnv("DATABASE_URL", VALID_DATABASE_URL);
		vi.stubEnv("PORT", undefined);
		vi.stubEnv("NODE_ENV", undefined);
	});

	it("applies defaults for PORT and NODE_ENV", async () => {
		const env = await loadEnv();

		expect(env).toEqual({
			PORT: 5000,
			NODE_ENV: "development",
			DATABASE_URL: VALID_DATABASE_URL,
		});
	});

	it("exposes only the variables the API declares, not all of process.env", async () => {
		vi.stubEnv("POSTGRES_PASSWORD", "should-not-leak");

		const env = await loadEnv();

		expect(Object.keys(env).sort()).toEqual([
			"DATABASE_URL",
			"NODE_ENV",
			"PORT",
		]);
	});

	it("coerces PORT from a string to a number", async () => {
		vi.stubEnv("PORT", "8080");

		const env = await loadEnv();

		expect(env.PORT).toBe(8080);
	});

	it.each(["development", "production", "test"])(
		"accepts NODE_ENV=%s",
		async (nodeEnv) => {
			vi.stubEnv("NODE_ENV", nodeEnv);

			const env = await loadEnv();

			expect(env.NODE_ENV).toBe(nodeEnv);
		},
	);

	it.each([
		["DATABASE_URL is missing", { DATABASE_URL: undefined }],
		["DATABASE_URL is not a URL", { DATABASE_URL: "not a url" }],
		["PORT is not numeric", { PORT: "abc" }],
		["NODE_ENV is unknown", { NODE_ENV: "staging" }],
	])("fails fast when %s", async (_label, overrides) => {
		for (const [key, value] of Object.entries(overrides)) {
			vi.stubEnv(key, value);
		}

		await expect(loadEnv()).rejects.toThrow(z.ZodError);
	});
});
