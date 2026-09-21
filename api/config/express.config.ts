import express, { Express } from "express";
import { EnvConfig } from "./env.config";

class ExpressServer {
	private readonly app: Express;
	private readonly env: EnvConfig;

	constructor(env: EnvConfig) {
		this.env = env;
		this.app = express();
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
		this.app.listen(this.env.PORT, () => {
			console.log(`Server is running on port ${this.env.PORT}`);
		});
	}
}
export default ExpressServer;
