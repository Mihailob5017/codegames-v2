import express from "express";
import type { Express } from "express";
import type { EnvConfig } from "./env.config.ts";

class ExpressServer {
	private readonly app: Express;
	private readonly env: EnvConfig;
	private serverInstance: any;
	constructor(env: EnvConfig) {
		this.env = env;
		this.app = express();
		this.serverInstance = null;
	}

	private setupMiddleware(): void {
		this.app.use(express.json());
	}

	private setupRoutes(): void {}

	public start(): void {
		this.setupMiddleware();
		this.setupRoutes();
		console.log("test if the env works");
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
