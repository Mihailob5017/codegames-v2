import express, { type ErrorRequestHandler } from "express";
import { DatabaseError } from "pg";
import pino from "pino";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, errorHandler } from "./error.middleware.ts";

// Build a real pg DatabaseError so the middleware's `instanceof` check matches.
const makeDbError = (
	code: string,
	fields: { constraint?: string; column?: string } = {},
) => {
	const error = new DatabaseError(
		"duplicate key value violates unique constraint",
		100,
		"error",
	);
	return Object.assign(error, { code, ...fields });
};

const buildApp = () => {
	const app = express();
	const forwardedErrors: unknown[] = [];
	app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
	app.get("/not-found", () => {
		throw new AppError("NOT_FOUND", { message: "User does not exist" });
	});
	app.get("/unexpected", () => {
		throw new Error("database password is private");
	});
	app.get("/after-response", (_req, res, next) => {
		res.status(200).json({ ok: true });
		next(new Error("response already sent"));
	});
	app.get("/invalid-body", () => {
		z.object({ email: z.email() }).parse({ email: "not-an-email" });
	});
	app.get("/duplicate-wrapped", () => {
		// Mirrors how Drizzle wraps the driver error: pg error lives on `cause`.
		const dbError = makeDbError("23505", { constraint: "users_email_unique" });
		throw new Error("Failed query: insert into users", { cause: dbError });
	});
	app.get("/duplicate-direct", () => {
		throw makeDbError("23505", { constraint: "users_email_unique" });
	});
	app.get("/db-unknown", () => {
		throw new Error("Failed query", { cause: makeDbError("99999") });
	});
	app.use(errorHandler);
	const captureError: ErrorRequestHandler = (error, _req, _res, _next) => {
		forwardedErrors.push(error);
	};
	app.use(captureError);
	return { app, forwardedErrors };
};

describe("errorHandler", () => {
	it("serializes an AppError with its status and public details", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/not-found");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			code: "NOT_FOUND",
			statusCode: 404,
			response: "Resource with that ID not found",
			message: "User does not exist",
			timestamp: expect.any(String),
		});
	});

	it("hides unexpected error details from the response", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/unexpected");

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			code: "INTERNAL_ERROR",
			statusCode: 500,
			response: "An internal server error occurred. Please try again later.",
			message: "An unexpected error occurred",
			timestamp: expect.any(String),
		});
		expect(response.text).not.toContain("private");
	});

	it("forwards errors that occur after the response was sent", async () => {
		const { app, forwardedErrors } = buildApp();

		const response = await request(app).get("/after-response");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ ok: true });
		expect(forwardedErrors).toHaveLength(1);
		const forwardedError = forwardedErrors[0];
		expect(forwardedError).toBeInstanceOf(Error);
		if (forwardedError instanceof Error) {
			expect(forwardedError.message).toBe("response already sent");
		}
	});

	it("maps a ZodError to a 400 validation error", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/invalid-body");

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			code: "VALIDATION_ERROR",
			statusCode: 400,
			message: "Invalid request data",
		});
		expect(response.body.details).toContainEqual(
			expect.objectContaining({ path: ["email"] }),
		);
	});

	it("maps a Drizzle-wrapped unique violation to a 409 conflict", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/duplicate-wrapped");

		expect(response.status).toBe(409);
		expect(response.body).toMatchObject({
			code: "CONFLICT",
			statusCode: 409,
			details: { constraint: "users_email_unique" },
		});
	});

	it("maps a directly-thrown pg unique violation to a 409 conflict", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/duplicate-direct");

		expect(response.status).toBe(409);
		expect(response.body.code).toBe("CONFLICT");
	});

	it("maps an unmapped pg error code to a 500 without leaking details", async () => {
		const { app } = buildApp();

		const response = await request(app).get("/db-unknown");

		expect(response.status).toBe(500);
		expect(response.body.code).toBe("INTERNAL_ERROR");
		expect(response.body.details).toBeUndefined();
	});
});
