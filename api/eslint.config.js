import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
export default defineConfig([
	globalIgnores(["dist", "coverage", "node_modules", "logs", "db/migrations"]),
	{
		files: ["**/*.ts"],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			eslintConfigPrettier,
		],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
]);
