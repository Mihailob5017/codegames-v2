import ExpressServer from "./config/express.config.ts";

import { env } from "./config/env.config.ts";

const server = new ExpressServer(env);

server.listen();

const shutdown = async () => {
	await server.stop();
	process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
