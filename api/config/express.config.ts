import express from "express";
import type { Express } from "express";
import type { EnvConfig } from "./env.config.ts";
import { default as adminRouter } from "../admin/admin.route.ts";
import { errorHandler } from "../middleware/error.middleware.ts";

class ExpressServer {
	private readonly app: Express;
	private readonly env: EnvConfig;
	private serverInstance: any;
	constructor(env: EnvConfig) {
		this.env = env;
		this.app = express();
		this.serverInstance = null;
		// Wired up front so the app can be exercised (e.g. by supertest) without listening.
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
	}

	public getApp(): Express {
		return this.app;
	}

	private setupMiddleware(): void {
		this.app.use(express.json());
	}

	private setupRoutes(): void {
		this.app.use(adminRouter);
	}

	// Must be registered last so it receives errors from every route and middleware above.
	private setupErrorHandling(): void {
		this.app.use(errorHandler);
	}

	public listen(): void {
		console.log("ENV", this.env.NODE_ENV);
		console.log("PORT", this.env.PORT);
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
