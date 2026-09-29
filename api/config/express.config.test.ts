import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpressServer from "./express.config.ts";

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
		server = new ExpressServer({
			PORT: port,
			NODE_ENV: "test",
			DATABASE_URL: "postgresql://unused@localhost/unused",
		});
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
