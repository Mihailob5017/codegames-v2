import express from "express";
import type { Express, Router } from "express";
import type { EnvConfig } from "./env.config.ts";
import { errorHandler } from "../middleware/error.middleware.ts";
import { pinoHttp } from "pino-http";
import { customLogLevel, logger } from "./logger.config.ts";

class ExpressServer {
	private readonly app: Express;
	private readonly env: EnvConfig;
	private serverInstance: any;
	constructor(env: EnvConfig, routes: Router[]) {
		this.env = env;
		this.app = express();
		this.serverInstance = null;
		// Wired up front so the app can be exercised (e.g. by supertest) without listening.
		this.setupMiddleware();
		this.setupRoutes(routes);
		this.setupErrorHandling();
	}
	public getApp(): Express {
		return this.app;
	}

	private setupMiddleware(): void {
		this.app.use(pinoHttp({ logger, customLogLevel }));
		this.app.use(express.json());
	}

	private setupRoutes(routes: Router[]): void {
		routes.forEach((route) => {
			this.app.use(route);
		});
	}

	// Must be registered last so it receives errors from every route and middleware above.
	private setupErrorHandling(): void {
		this.app.use(errorHandler);
	}

	public listen(): void {
		logger.info(
			{ env: this.env.NODE_ENV, port: this.env.PORT },
			"Server started",
		);
		this.serverInstance = this.app.listen(this.env.PORT, () => {
			console.log(`Server is running on port ${this.env.PORT}`);
		});
	}
	public stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.serverInstance.close((err: any) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}
export default ExpressServer;
