import { createServer } from "node:net";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpressServer from "./express.config.ts";
import type { EnvConfig } from "./env.config.ts";
import adminRouter from "../admin/admin.route.ts";

// A full, valid config; each test overrides only what it is about.
const testEnv = (overrides: Partial<EnvConfig> = {}): EnvConfig => ({
	PORT: 0,
	NODE_ENV: "test",
	DATABASE_URL: "postgresql://unused@localhost/unused",
	RATE_LIMIT_WINDOW_MS: 60_000,
	RATE_LIMIT_MAX: 1_000,
	TRUST_PROXY: 0,
	...overrides,
});

const buildApp = (overrides: Partial<EnvConfig> = {}) =>
	new ExpressServer(testEnv(overrides), [adminRouter]).getApp();

// The lifecycle tests never reach the database; stubbing the repository keeps
// db.config.ts (which needs DATABASE_URL at import time) out of the module graph.
vi.mock(import("../admin/admin.repository.ts"), () => ({
	AdminRepository: {
		createUser: vi.fn(),
		deleteUser: vi.fn(),
		getUserById: vi.fn(),
		getAllUsers: vi.fn(),
	},
}));

// Asks the OS for a free port so parallel runs never collide.
const getFreePort = () =>
	new Promise<number>((resolve, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen(0, () => {
			const address = probe.address();
			const port = typeof address === "object" && address ? address.port : 0;
			probe.close(() => resolve(port));
		});
	});

describe("ExpressServer lifecycle", () => {
	let server: ExpressServer;
	let baseUrl: string;

	beforeEach(async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const port = await getFreePort();
		baseUrl = `http://127.0.0.1:${port}`;
		server = new ExpressServer(testEnv({ PORT: port }), [adminRouter]);
	});

	afterEach(async () => {
		await server.stop().catch(() => {});
	});

	it("serves requests on the configured port after listen()", async () => {
		server.listen();

		const res = await vi.waitFor(() =>
			fetch(`${baseUrl}/api/v1/admin/health-check`),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});

	it("stops accepting connections after stop()", async () => {
		server.listen();
		await vi.waitFor(() => fetch(`${baseUrl}/api/v1/admin/health-check`));

		await server.stop();

		await expect(
			fetch(`${baseUrl}/api/v1/admin/health-check`),
		).rejects.toThrow();
	});
});

describe("security headers", () => {
	const expectSecurityHeaders = (res: request.Response) => {
		expect(res.headers["content-security-policy"]).toBeDefined();
		expect(res.headers["x-content-type-options"]).toBe("nosniff");
		expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
		expect(res.headers["strict-transport-security"]).toBeDefined();
		expect(res.headers["x-powered-by"]).toBeUndefined();
	};

	it("sets them on a successful response", async () => {
		const res = await request(buildApp()).get("/api/v1/admin/health-check");

		expect(res.status).toBe(200);
		expectSecurityHeaders(res);
	});

	it("sets them on the 404 for an unknown route", async () => {
		const res = await request(buildApp()).get("/api/v1/unknown");

		expect(res.status).toBe(404);
		expectSecurityHeaders(res);
	});

	it("sets them when the body cannot be parsed, before any route runs", async () => {
		const res = await request(buildApp())
			.post("/api/v1/admin/users")
			.set("Content-Type", "application/json")
			.send('{"username": ');

		expect(res.status).toBe(400);
		expectSecurityHeaders(res);
	});
});

describe("rate limiting", () => {
	it("responds 429 with the JSON error shape once the limit is used up", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 2, RATE_LIMIT_WINDOW_MS: 60_000 });
		await request(app).get("/api/v1/unknown");
		await request(app).get("/api/v1/unknown");

		const res = await request(app).get("/api/v1/unknown");

		expect(res.status).toBe(429);
		expect(res.headers["content-type"]).toMatch(/application\/json/);
		expect(res.body).toEqual({
			code: "TOO_MANY_REQUESTS",
			statusCode: 429,
			response: "Too many requests. Please try again later.",
			message: "Rate limit of 2 requests per 60 seconds exceeded",
			timestamp: expect.any(String),
		});
	});

	it("tells the client when to retry and still sends the security headers", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 1 });
		await request(app).get("/api/v1/unknown");

		const res = await request(app).get("/api/v1/unknown");

		expect(res.status).toBe(429);
		expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
		expect(res.headers["content-security-policy"]).toBeDefined();
		expect(res.headers["x-powered-by"]).toBeUndefined();
	});

	it("allows requests up to the limit", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 2 });

		const first = await request(app).get("/api/v1/unknown");
		const second = await request(app).get("/api/v1/unknown");

		expect(first.status).toBe(404);
		expect(second.status).toBe(404);
	});

	it("never limits the health check, so monitors keep seeing it as healthy", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 1 });

		const statuses = [];
		for (let i = 0; i < 3; i++) {
			statuses.push(
				(await request(app).get("/api/v1/admin/health-check")).status,
			);
		}

		expect(statuses).toEqual([200, 200, 200]);
	});

	it("ignores X-Forwarded-For by default, so a client cannot dodge the limit by faking it", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 1, TRUST_PROXY: 0 });
		await request(app)
			.get("/api/v1/unknown")
			.set("X-Forwarded-For", "203.0.113.1");

		const res = await request(app)
			.get("/api/v1/unknown")
			.set("X-Forwarded-For", "203.0.113.2");

		expect(res.status).toBe(429);
	});

	it("limits each client separately behind a trusted proxy", async () => {
		const app = buildApp({ RATE_LIMIT_MAX: 1, TRUST_PROXY: 1 });
		await request(app)
			.get("/api/v1/unknown")
			.set("X-Forwarded-For", "203.0.113.1");

		const otherClient = await request(app)
			.get("/api/v1/unknown")
			.set("X-Forwarded-For", "203.0.113.2");
		const sameClient = await request(app)
			.get("/api/v1/unknown")
			.set("X-Forwarded-For", "203.0.113.1");

		expect(otherClient.status).toBe(404);
		expect(sameClient.status).toBe(429);
	});
});
