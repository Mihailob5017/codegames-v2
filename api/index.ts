import ExpressServer from "./config/express.config";

import { validateEnv } from "./config/env.config";

const env = validateEnv(process.env);

const server = new ExpressServer(env);

const startServer = async () => {
	await server.start();
};

startServer();
