import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error.middleware.ts";

const httpError = (status: number, message: string, expose: boolean) =>
	Object.assign(new Error(message), { status, expose });

// A throwaway app whose routes fail in controlled ways, so the handler is tested in isolation.
const buildApp = () => {
	const app = express();
	app.get("/unexpected", () => {
		throw new Error("db password is hunter2");
	});
	app.get("/client-exposed", () => {
		throw httpError(422, "Unprocessable thing", true);
	});
	app.get("/client-hidden", () => {
		throw httpError(403, "internal policy id 42", false);
	});
	app.get("/non-http-status", () => {
		throw httpError(302, "redirect-ish", true);
	});
	app.get("/after-response", (_req, res) => {
		res.status(200).json({ ok: true });
		throw new Error("late failure");
	});
	app.use(errorHandler);
	return app;
};

describe("errorHandler", () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("responds 500 with a generic JSON body for unexpected errors", async () => {
		const res = await request(buildApp()).get("/unexpected");

		expect(res.status).toBe(500);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toEqual({ error: "Internal server error" });
		expect(res.text).not.toContain("hunter2");
	});

	it("logs unexpected errors server-side so they are not silently swallowed", async () => {
		await request(buildApp()).get("/unexpected");

		expect(consoleError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "db password is hunter2" }),
		);
	});

	it("passes through the status and message of exposable client errors", async () => {
		const res = await request(buildApp()).get("/client-exposed");

		expect(res.status).toBe(422);
		expect(res.body).toEqual({ error: "Unprocessable thing" });
		expect(consoleError).not.toHaveBeenCalled();
	});

	it("keeps the client status but hides the message when it is not exposable", async () => {
		const res = await request(buildApp()).get("/client-hidden");

		expect(res.status).toBe(403);
		expect(res.body).toEqual({ error: "Bad request" });
	});

	it("treats a non-4xx status as an unexpected error", async () => {
		const res = await request(buildApp()).get("/non-http-status");

		expect(res.status).toBe(500);
		expect(res.body).toEqual({ error: "Internal server error" });
	});

	it("leaves the original response intact when the error happens after it was sent", async () => {
		const res = await request(buildApp()).get("/after-response");

		expect(res.status).toBe(200);
		expect(res.body).toEqual({ ok: true });
		expect(consoleError).not.toHaveBeenCalled();
	});
});
