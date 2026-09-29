import ExpressServer from "./config/express.config.ts";

import { env } from "./config/env.config.ts";

const server = new ExpressServer(env);

const startServer = async () => {
	await server.start();
};

startServer()
	.then(() => {
		process.on("SIGTERM", async () => {
			await server.stop();
			process.exit(0);
		});
		process.on("SIGINT", async () => {
			await server.stop();
			process.exit(0);
		});
		console.log("Server started successfully");
	})
	.catch((error) => {
		console.error("Failed to start server:", error);
		process.exit(1);
	});
