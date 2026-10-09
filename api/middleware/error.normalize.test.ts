import { DatabaseError } from "pg";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../shared/app-error.shared.ts";
import {
	isClientHttpStatus,
	isDatabaseError,
	normalizeError,
	toResponseBody,
} from "./error.normalize.ts";

// A real pg DatabaseError so the `instanceof` checks match.
const makeDbError = (
	code: string | undefined,
	fields: { constraint?: string; column?: string } = {},
) => {
	const error = new DatabaseError("pg failure", 100, "error");
	return Object.assign(error, { code, ...fields });
};

// Drizzle wraps the driver error and keeps it on `cause`.
const wrapLikeDrizzle = (cause: unknown) =>
	new Error("Failed query: insert into users", { cause });

// Body-parser style: a plain Error tagged with an HTTP status.
const errorWith = (fields: { status?: unknown; statusCode?: unknown }) =>
	Object.assign(new Error("tagged"), fields);

describe("isDatabaseError", () => {
	it("returns a pg error thrown directly", () => {
		const dbError = makeDbError("23505");

		expect(isDatabaseError(dbError)).toBe(dbError);
	});

	it("returns the pg error from the cause of a wrapped error", () => {
		const dbError = makeDbError("23505");

		expect(isDatabaseError(wrapLikeDrizzle(dbError))).toBe(dbError);
	});

	it.each([
		["a plain Error", new Error("nope")],
		["an Error whose cause is not a pg error", wrapLikeDrizzle("text")],
		["a non-Error value", "oops"],
		["null", null],
	])("returns null for %s", (_label, value) => {
		expect(isDatabaseError(value)).toBeNull();
	});
});

describe("isClientHttpStatus", () => {
	it.each([
		["status 400", errorWith({ status: 400 }), 400],
		["statusCode 413", errorWith({ statusCode: 413 }), 413],
		["the lowest 4xx", errorWith({ status: 400 }), 400],
		["the highest 4xx", errorWith({ status: 499 }), 499],
		[
			"statusCode over status when both are set",
			errorWith({ statusCode: 404, status: 400 }),
			404,
		],
	])("returns the status for %s", (_label, error, expected) => {
		expect(isClientHttpStatus(error)).toBe(expected);
	});

	it.each([
		["a 3xx status", errorWith({ status: 399 })],
		["a 5xx status", errorWith({ status: 500 })],
		["a 503 status", errorWith({ status: 503 })],
		["a numeric string", errorWith({ status: "400" })],
		["no status", new Error("plain")],
		[
			"a 5xx statusCode even if status is 4xx",
			errorWith({ statusCode: 500, status: 400 }),
		],
		["a non-Error object with a status", { status: 400 }],
		["a non-Error value", "oops"],
	])("returns null for %s", (_label, value) => {
		expect(isClientHttpStatus(value)).toBeNull();
	});
});

describe("normalizeError", () => {
	it("returns an AppError unchanged", () => {
		const appError = new AppError("NOT_FOUND", { message: "missing" });

		expect(normalizeError(appError)).toBe(appError);
	});

	it("maps a ZodError to a validation error with one entry per field", () => {
		const result = z
			.object({ email: z.email(), age: z.number() })
			.safeParse({ email: "nope", age: "x" });
		if (result.success) throw new Error("expected the parse to fail");

		const appError = normalizeError(result.error);

		expect(appError.code).toBe("VALIDATION_ERROR");
		expect(appError.message).toBe("Invalid request data");
		expect(appError.details).toEqual([
			{ path: ["email"], message: expect.any(String) },
			{ path: ["age"], message: expect.any(String) },
		]);
		expect(appError.cause).toBe(result.error);
	});

	it.each([
		["23505", "CONFLICT"],
		["23503", "VALIDATION_ERROR"],
		["23502", "VALIDATION_ERROR"],
	] as const)(
		"maps pg code %s to %s with the constraint and column",
		(pgCode, code) => {
			const dbError = makeDbError(pgCode, {
				constraint: "users_email_unique",
				column: "email",
			});

			const appError = normalizeError(wrapLikeDrizzle(dbError));

			expect(appError.code).toBe(code);
			expect(appError.details).toEqual({
				constraint: "users_email_unique",
				column: "email",
			});
		},
	);

	it.each([
		["an unmapped pg code", "40P01"],
		["no pg code", undefined],
	])("maps %s to an internal error without details", (_label, pgCode) => {
		const dbError = makeDbError(pgCode, { constraint: "secret_constraint" });

		const appError = normalizeError(dbError);

		expect(appError.code).toBe("INTERNAL_ERROR");
		expect(appError.details).toBeNull();
	});

	it("keeps the original error as the cause of a database error", () => {
		const wrapped = wrapLikeDrizzle(makeDbError("23505"));

		expect(normalizeError(wrapped).cause).toBe(wrapped);
	});

	it.each([
		["a mapped pg code", "23505", "The request violates a database constraint"],
		["an unmapped pg code", "42P01", "An unexpected error occurred"],
	])("does not expose the pg message for %s", (_label, pgCode, message) => {
		const dbError = Object.assign(
			new DatabaseError('relation "users" does not exist', 100, "error"),
			{ code: pgCode },
		);

		const appError = normalizeError(wrapLikeDrizzle(dbError));

		expect(appError.message).toBe(message);
		expect(toResponseBody(appError).message).not.toContain("users");
	});

	it.each([
		[400, "VALIDATION_ERROR"],
		[413, "CONTENT_TOO_LARGE"],
		// A 4xx without its own code still counts as a client error.
		[415, "VALIDATION_ERROR"],
	] as const)("maps an error tagged %i to %s", (status, code) => {
		const error = errorWith({ status });

		const appError = normalizeError(error);

		expect(appError.code).toBe(code);
		expect(appError.message).toBe("Request could not be processed");
		expect(appError.cause).toBe(error);
	});

	it.each([
		["a plain Error", new Error("database password is private")],
		["an error tagged with a 5xx status", errorWith({ status: 503 })],
		["a thrown string", "oops"],
		["a thrown object with a 4xx status", { status: 400 }],
		["undefined", undefined],
	])("maps %s to an internal error", (_label, value) => {
		const appError = normalizeError(value);

		expect(appError.code).toBe("INTERNAL_ERROR");
		expect(appError.message).toBe("An unexpected error occurred");
		expect(appError.cause).toBe(value);
	});
});

describe("toResponseBody", () => {
	it("exposes only the public fields of the error", () => {
		const appError = new AppError("CONFLICT", {
			message: "Username taken",
			details: { constraint: "users_username_unique" },
			cause: new Error("private driver message"),
		});

		const body = toResponseBody(appError);

		expect(body).toEqual({
			code: "CONFLICT",
			statusCode: 409,
			response: "Resource already exists",
			message: "Username taken",
			details: { constraint: "users_username_unique" },
			timestamp: appError.timestamp,
		});
		expect(JSON.stringify(body)).not.toContain("private");
	});
});
