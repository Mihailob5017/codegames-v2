import express from "express";
import type { Express, Router } from "express";
import type { EnvConfig } from "./env.config.ts";
import {
	errorHandler,
	unknownRouteHandler,
} from "../error/error.middleware.ts";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { customLogLevel, logger } from "./logger.config.ts";
import { AppError } from "../error/app-error.ts";
import { adminRoutes } from "../shared/routes.shared.ts";

class ExpressServer {
	private readonly app: Express;
	private readonly env: EnvConfig;
	private serverInstance: ReturnType<Express["listen"]> | null;
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
		const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, TRUST_PROXY } = this.env;

		// The rate limiter keys on req.ip, which is only the real client once
		// Express knows how many proxies to look past (TD-028).
		this.app.set("trust proxy", TRUST_PROXY);

		const rateLimiter = rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			limit: RATE_LIMIT_MAX,
			logger,
			// Uptime monitors poll the health check often; limiting it would report a healthy API as down.
			skip: (req) => req.path === adminRoutes.healthCheck,
			handler: (_req, _res, next) => {
				next(
					new AppError("TOO_MANY_REQUESTS", {
						message: `Rate limit of ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 1000} seconds exceeded`,
					}),
				);
			},
		});

		this.app.use(pinoHttp({ logger, customLogLevel }));
		this.app.use(helmet());
		this.app.use(rateLimiter);
		this.app.use(express.json());
	}

	private setupRoutes(routes: Router[]): void {
		routes.forEach((route) => {
			this.app.use(route);
		});
		this.app.use(unknownRouteHandler);
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
			this.serverInstance?.close((err?: Error | null) => {
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
