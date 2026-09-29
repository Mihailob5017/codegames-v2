import { describe, expect, it } from "vitest";
import { schemaErrors } from "./errors.ts";

describe("schemaErrors", () => {
	it.each([
		[schemaErrors.lessThan("age", 100), "age must be less than 100"],
		[schemaErrors.greaterThan("age", 0), "age must be greater than 0"],
		[
			schemaErrors.length("username", 3, 30),
			"username must be between 3 and 30 characters",
		],
		[
			schemaErrors.mustContain("password", "a digit"),
			"password must contain a digit",
		],
		[
			schemaErrors.mustBeType("email", "valid email"),
			"email must be a valid email",
		],
	])("formats %j", (actual, expected) => {
		expect(actual).toBe(expected);
	});
});
