import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpressServer from "../config/express.config.ts";
import { createUserValidation } from "./admin.validation.ts";

// Wrap the real validator so a single test can force an unexpected failure.
vi.mock(import("./admin.validation.ts"), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		createUserValidation: vi.fn(actual.createUserValidation),
	};
});

const app = new ExpressServer({
	PORT: 0,
	NODE_ENV: "test",
	DATABASE_URL: "postgresql://unused@localhost/unused",
}).getApp();

// Errors a handler raises after (or instead of) responding never reach the client,
// e.g. "headers already sent" from a double response. Capture them so tests can assert on them.
const pipelineErrors: unknown[] = [];
const captureErrors: ErrorRequestHandler = (err, _req, _res, next) => {
	pipelineErrors.push(err);
	next(err);
};
app.use(captureErrors);

beforeEach(() => {
	pipelineErrors.length = 0;
});

// Routes are the public contract, so tests use literal paths rather than the constants.
const HEALTH_CHECK = "/api/v1/admin/health-check";
const CREATE_USER = "/api/v1/admin/create-user";

const validUser = () => ({
	username: "player_one",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "secret1",
});

describe(`GET ${HEALTH_CHECK}`, () => {
	it("responds 200 with an ok status", async () => {
		const res = await request(app).get(HEALTH_CHECK);

		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toEqual({ status: "ok" });
	});
});

describe(`POST ${CREATE_USER}`, () => {
	it("responds 200 with the validated user for a valid payload", async () => {
		const res = await request(app).post(CREATE_USER).send(validUser());

		expect(res.status).toBe(200);
		expect(res.body).toEqual(validUser());
		expect(pipelineErrors).toEqual([]);
	});

	it("drops privileged fields sent by the client", async () => {
		const res = await request(app)
			.post(CREATE_USER)
			.send({ ...validUser(), isAdmin: true, isVerified: true });

		expect(res.status).toBe(200);
		expect(res.body).not.toHaveProperty("isAdmin");
		expect(res.body).not.toHaveProperty("isVerified");
	});

	it("responds 400 with a per-field error list for an invalid payload", async () => {
		const res = await request(app)
			.post(CREATE_USER)
			.send({ ...validUser(), username: "ab", email: "nope" });

		expect(res.status).toBe(400);
		expect(res.body.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ["username"],
					message: "username must be between 3 and 30 characters",
				}),
				expect.objectContaining({
					path: ["email"],
					message: "email must be a valid email",
				}),
			]),
		);
		expect(res.body.errors).toHaveLength(2);
		expect(pipelineErrors).toEqual([]);
	});

	it("responds 400 when the body is missing", async () => {
		const res = await request(app).post(CREATE_USER);

		expect(res.status).toBe(400);
		expect(res.body.errors).toBeInstanceOf(Array);
	});

	it("responds 400 when the body is not JSON", async () => {
		const res = await request(app)
			.post(CREATE_USER)
			.set("Content-Type", "text/plain")
			.send("username=player_one");

		expect(res.status).toBe(400);
	});

	it("responds 400 with a JSON error for malformed JSON", async () => {
		const res = await request(app)
			.post(CREATE_USER)
			.set("Content-Type", "application/json")
			.send('{"username": ');

		expect(res.status).toBe(400);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toEqual({ error: expect.any(String) });
		expect(res.text).not.toMatch(/at .+\.(js|ts):\d+/);
	});

	it("responds 413 with a JSON error when the body exceeds the size limit", async () => {
		const res = await request(app)
			.post(CREATE_USER)
			.send({ ...validUser(), firstName: "a".repeat(200 * 1024) });

		expect(res.status).toBe(413);
		expect(res.body).toEqual({ error: expect.any(String) });
	});

	it("responds 500 with a generic message and does not leak internal error details", async () => {
		vi.mocked(createUserValidation).mockImplementationOnce(() => {
			throw new Error("connection string postgres://secret@db");
		});

		const res = await request(app).post(CREATE_USER).send(validUser());

		expect(res.status).toBe(500);
		expect(res.body).toEqual({ error: "Internal server error" });
		expect(res.text).not.toContain("secret");
		expect(pipelineErrors).toEqual([]);
	});

	it("is not reachable with GET", async () => {
		const res = await request(app).get(CREATE_USER);

		expect(res.status).toBe(404);
	});
});

describe("unknown routes", () => {
	it.each(["/", "/api/v1/admin", "/api/v2/admin/health-check"])(
		"responds 404 for %s",
		async (path) => {
			const res = await request(app).get(path);

			expect(res.status).toBe(404);
		},
	);
});
