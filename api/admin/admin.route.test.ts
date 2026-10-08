import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpressServer from "../config/express.config.ts";
import type { User } from "../db/schema.ts";
import { AdminRepository } from "./admin.repository.ts";
import adminRouter from "./admin.route.ts";

// Replace the DB boundary so the controller and service run for real without
// importing db.config.ts (which needs DATABASE_URL) or touching a database.
vi.mock(import("./admin.repository.ts"), () => ({
	AdminRepository: {
		createUser: vi.fn(),
		deleteUser: vi.fn(),
		getUserById: vi.fn(),
		getAllUsers: vi.fn(),
	},
}));

const app = new ExpressServer(
	{
		PORT: 0,
		NODE_ENV: "test",
		DATABASE_URL: "postgresql://unused@localhost/unused",
	},
	[adminRouter],
).getApp();

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
	// restoreMocks only covers spies; repository mocks keep calls and queued values otherwise.
	vi.resetAllMocks();
});

// Routes are the public contract, so tests use literal paths rather than the constants.
const HEALTH_CHECK = "/api/v1/admin/health-check";
const USERS = "/api/v1/admin/users";
const userById = (id: string | number) => `${USERS}/${id}`;

const validUser = () => ({
	username: "player_one",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "secret1",
});

// A row as the database returns it, including the fields the API must never expose.
const storedUser = (): User => ({
	...validUser(),
	id: 1,
	isAdmin: false,
	isVerified: false,
	score: 0,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
});

describe(`GET ${HEALTH_CHECK}`, () => {
	it("responds 200 with an ok status", async () => {
		const res = await request(app).get(HEALTH_CHECK);

		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toEqual({ status: "ok" });
	});
});

describe(`POST ${USERS}`, () => {
	it("responds 201 with the public fields of the created user", async () => {
		vi.mocked(AdminRepository.createUser).mockResolvedValueOnce(storedUser());

		const res = await request(app).post(USERS).send(validUser());

		expect(res.status).toBe(201);
		expect(res.body).toEqual({
			id: 1,
			username: "player_one",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@example.com",
			score: 0,
			isVerified: false,
		});
		expect(AdminRepository.createUser).toHaveBeenCalledWith(validUser());
		expect(pipelineErrors).toEqual([]);
	});

	it("never returns the password or other internal fields", async () => {
		vi.mocked(AdminRepository.createUser).mockResolvedValueOnce(storedUser());

		const res = await request(app).post(USERS).send(validUser());

		expect(res.body).not.toHaveProperty("password");
		expect(res.body).not.toHaveProperty("isAdmin");
		expect(res.body).not.toHaveProperty("createdAt");
		expect(res.body).not.toHaveProperty("updatedAt");
		expect(res.text).not.toContain("secret1");
	});

	it("drops privileged fields sent by the client before saving", async () => {
		vi.mocked(AdminRepository.createUser).mockResolvedValueOnce(storedUser());

		await request(app)
			.post(USERS)
			.send({ ...validUser(), isAdmin: true, isVerified: true });

		expect(AdminRepository.createUser).toHaveBeenCalledWith(validUser());
	});

	it("responds 400 with a per-field error list for an invalid payload", async () => {
		const res = await request(app)
			.post(USERS)
			.send({ ...validUser(), username: "ab", email: "nope" });

		expect(res.status).toBe(400);
		expect(res.body.details).toEqual(
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
		expect(res.body.details).toHaveLength(2);
		expect(AdminRepository.createUser).not.toHaveBeenCalled();
		expect(pipelineErrors).toEqual([]);
	});

	it("responds 400 when the body is missing", async () => {
		const res = await request(app).post(USERS);

		expect(res.status).toBe(400);
		expect(res.body.details).toBeInstanceOf(Array);
	});

	it("responds 400 when the body is not JSON", async () => {
		const res = await request(app)
			.post(USERS)
			.set("Content-Type", "text/plain")
			.send("username=player_one");

		expect(res.status).toBe(400);
	});

	it("responds 400 with a JSON error for malformed JSON", async () => {
		const res = await request(app)
			.post(USERS)
			.set("Content-Type", "application/json")
			.send('{"username": ');

		expect(res.status).toBe(400);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toMatchObject({
			code: "VALIDATION_ERROR",
			statusCode: 400,
		});
		expect(res.text).not.toMatch(/at .+\.(js|ts):\d+/);
	});

	it("responds 413 with a JSON error when the body exceeds the size limit", async () => {
		const res = await request(app)
			.post(USERS)
			.send({ ...validUser(), firstName: "a".repeat(200 * 1024) });

		expect(res.status).toBe(413);
		expect(res.body).toMatchObject({
			code: "CONTENT_TOO_LARGE",
			statusCode: 413,
		});
	});

	it("responds 500 with a generic message and does not leak internal error details", async () => {
		vi.mocked(AdminRepository.createUser).mockRejectedValueOnce(
			new Error("connection string postgres://secret@db"),
		);

		const res = await request(app).post(USERS).send(validUser());

		expect(res.status).toBe(500);
		expect(res.body).toEqual(internalErrorBody());
		expect(res.text).not.toContain("secret");
		expect(pipelineErrors).toEqual([]);
	});
});

// The public representation of storedUser(): what every endpoint may expose.
const publicUser = {
	id: 1,
	username: "player_one",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	score: 0,
	isVerified: false,
};

const hiddenFields = ["password", "isAdmin", "createdAt", "updatedAt"];

const internalErrorBody = () => ({
	code: "INTERNAL_ERROR",
	statusCode: 500,
	response: "An internal server error occurred. Please try again later.",
	message: "An unexpected error occurred",
	timestamp: expect.any(String),
});

const notFoundErrorBody = () => ({
	code: "NOT_FOUND",
	statusCode: 404,
	response: "Resource with that ID not found",
	message: "User with the given ID doesn't exist",
	timestamp: expect.any(String),
});

const invalidUserIdErrorBody = () => ({
	code: "VALIDATION_ERROR",
	statusCode: 400,
	response: "Some fields are invalid.Please check them and try again",
	message: "Invalid user ID",
	details: { fields: ["id"], reason: "User ID must be a positive integer" },
	timestamp: expect.any(String),
});

describe(`GET ${USERS}`, () => {
	it("responds 200 with the public fields of every user", async () => {
		vi.mocked(AdminRepository.getAllUsers).mockResolvedValueOnce([
			storedUser(),
			{ ...storedUser(), id: 2, username: "player_two" },
		]);

		const res = await request(app).get(USERS);

		expect(res.status).toBe(200);
		expect(res.body).toEqual([
			publicUser,
			{ ...publicUser, id: 2, username: "player_two" },
		]);
		expect(res.text).not.toContain("secret1");
		for (const user of res.body) {
			for (const field of hiddenFields) expect(user).not.toHaveProperty(field);
		}
	});

	it("responds 200 with an empty list when there are no users", async () => {
		vi.mocked(AdminRepository.getAllUsers).mockResolvedValueOnce([]);

		const res = await request(app).get(USERS);

		expect(res.status).toBe(200);
		expect(res.body).toEqual([]);
	});

	it("responds 500 without leaking internal error details", async () => {
		vi.mocked(AdminRepository.getAllUsers).mockRejectedValueOnce(
			new Error("connection string postgres://secret@db"),
		);

		const res = await request(app).get(USERS);

		expect(res.status).toBe(500);
		expect(res.body).toEqual(internalErrorBody());
		expect(res.text).not.toContain("secret");
	});
});

describe(`GET ${USERS}/:id`, () => {
	it("responds 200 with the public fields of the user", async () => {
		vi.mocked(AdminRepository.getUserById).mockResolvedValueOnce(storedUser());

		const res = await request(app).get(userById(1));

		expect(res.status).toBe(200);
		expect(res.body).toEqual(publicUser);
		expect(AdminRepository.getUserById).toHaveBeenCalledWith(1);
		expect(res.text).not.toContain("secret1");
	});

	it("responds 404 when the user does not exist", async () => {
		vi.mocked(AdminRepository.getUserById).mockResolvedValueOnce(null);

		const res = await request(app).get(userById(999));

		expect(res.status).toBe(404);
		expect(res.body).toEqual(notFoundErrorBody());
	});

	it.each(["abc", "0", "-1", "1.5"])(
		"responds 400 for the invalid id %s without querying",
		async (id) => {
			const res = await request(app).get(userById(id));

			expect(res.status).toBe(400);
			expect(res.body).toEqual(invalidUserIdErrorBody());
			expect(AdminRepository.getUserById).not.toHaveBeenCalled();
		},
	);

	it("responds 500 without leaking internal error details", async () => {
		vi.mocked(AdminRepository.getUserById).mockRejectedValueOnce(
			new Error("connection string postgres://secret@db"),
		);

		const res = await request(app).get(userById(1));

		expect(res.status).toBe(500);
		expect(res.body).toEqual(internalErrorBody());
		expect(res.text).not.toContain("secret");
	});
});

describe(`DELETE ${USERS}/:id`, () => {
	it("deletes the user with the id from the path", async () => {
		vi.mocked(AdminRepository.deleteUser).mockResolvedValueOnce();

		const res = await request(app).delete(userById(7));

		expect(res.status).toBe(200);
		expect(AdminRepository.deleteUser).toHaveBeenCalledWith(7);
		expect(pipelineErrors).toEqual([]);
	});

	it.each(["abc", "0", "-1", "1.5"])(
		"responds 400 for the invalid id %s without deleting",
		async (id) => {
			const res = await request(app).delete(userById(id));

			expect(res.status).toBe(400);
			expect(res.body).toEqual(invalidUserIdErrorBody());
			expect(AdminRepository.deleteUser).not.toHaveBeenCalled();
		},
	);

	it("is not reachable on the collection path", async () => {
		const res = await request(app).delete(USERS);

		expect(res.status).toBe(404);
		expect(AdminRepository.deleteUser).not.toHaveBeenCalled();
	});
});

describe("unknown routes", () => {
	it.each([
		"/",
		"/api/v1/admin",
		"/api/v2/admin/health-check",
		// The old verb-style paths were replaced by REST nouns (TD-018).
		"/api/v1/admin/get-users",
		"/api/v1/admin/get-user?id=1",
	])("responds 404 for %s", async (path) => {
		const res = await request(app).get(path);

		expect(res.status).toBe(404);
	});
});
