import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./app-error.shared.ts";

describe("AppError", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		["VALIDATION_ERROR", 400],
		["NOT_FOUND", 404],
		["CONFLICT", 409],
		["CONTENT_TOO_LARGE", 413],
		["INTERNAL_ERROR", 500],
	] as const)("maps %s to status %i", (code, statusCode) => {
		const error = new AppError(code, { message: "msg" });

		expect(error.code).toBe(code);
		expect(error.statusCode).toBe(statusCode);
	});

	it("takes the public response text from the error catalogue", () => {
		const error = new AppError("CONFLICT", { message: "msg" });

		expect(error.response).toBe("Resource already exists");
	});

	it("keeps the message, details and cause it was created with", () => {
		const cause = new Error("driver failure");

		const error = new AppError("NOT_FOUND", {
			message: "User does not exist",
			details: { id: 7 },
			cause,
		});

		expect(error.message).toBe("User does not exist");
		expect(error.details).toEqual({ id: 7 });
		expect(error.cause).toBe(cause);
	});

	it("is a real Error named AppError", () => {
		const error = new AppError("NOT_FOUND", { message: "msg" });

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("AppError");
	});

	it("stamps the time it was created", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));

		const error = new AppError("NOT_FOUND", { message: "msg" });

		expect(error.timestamp).toEqual(new Date("2026-01-02T03:04:05.000Z"));
	});
});
