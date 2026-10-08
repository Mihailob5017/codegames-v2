import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { customLogLevel } from "./logger.config.ts";

const appForStatus = (statusCode: number, error?: Error) => {
	const app = express();
	app.get("/", (req, res) => {
		res.status(statusCode).json({ level: customLogLevel(req, res, error) });
	});
	return app;
};

describe("customLogLevel", () => {
	it("uses error level when a request has an error", async () => {
		const response = await request(appForStatus(400, new Error("failed"))).get(
			"/",
		);

		expect(response.body).toEqual({ level: "error" });
	});

	it("uses error level for server errors", async () => {
		const response = await request(appForStatus(500)).get("/");

		expect(response.body).toEqual({ level: "error" });
	});

	it("uses warn level for client errors", async () => {
		const response = await request(appForStatus(400)).get("/");

		expect(response.body).toEqual({ level: "warn" });
	});

	it("uses info level for successful responses", async () => {
		const response = await request(appForStatus(200)).get("/");

		expect(response.body).toEqual({ level: "info" });
	});
});
