import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.ts"],
		exclude: ["node_modules", "dist", "logs/**"],
		// Every test starts from a clean slate: no leaked spies, mocks or env stubs.
		restoreMocks: true,
		unstubEnvs: true,
		coverage: {
			provider: "v8",
			include: ["**/*.ts"],
			exclude: [
				"**/*.test.ts",
				"vitest.config.ts",
				// Entrypoints and tooling: exercised by running the app, not by unit tests.
				"index.ts",
				"db/seed.ts",
				"db/migrations/**",
				"config/drizzle.config.ts",
				"config/db.config.ts",
				// Declarations only, no runtime code.
				"db/schema.ts",
				"types/**",
			],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
});
