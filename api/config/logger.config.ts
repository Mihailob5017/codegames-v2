import path from "node:path";
import pino from "pino";
import type { Request, Response } from "express";
const NODE_ENV = process.env.NODE_ENV ?? "development";
const LOG_DIR = path.resolve("logs");

const isTestEnv = NODE_ENV === "test";
const isDevEnv = NODE_ENV === "development";

const fileTarget = (
	name: string,
	level: pino.Level,
): pino.TransportTargetOptions => ({
	target: "pino-roll",
	level,
	options: {
		file: path.join(LOG_DIR, name, name),
		frequency: "daily",
		dateFormat: "yyyy-MM-dd",
		mkdir: true,
		limit: { count: 7, removeOtherLogFiles: true },
	},
});

const prettyTarget: pino.TransportTargetOptions = {
	target: "pino-pretty",
	level: "debug",
	options: {
		colorize: true,
		translateTime: "SYS:HH:MM:ss",
		ignore: "pid,hostname",
	},
};

const targets = [
	...(isDevEnv ? [prettyTarget] : []),
	fileTarget("info", "info"),
	fileTarget("error", "error"),
];

export const logger = pino(
	{
		level: isTestEnv ? "silent" : "debug",
		serializers: { err: pino.stdSerializers.errWithCause },
		redact: ["req.headers.authorization", "req.headers.cookie"],
	},
	isTestEnv ? undefined : pino.transport({ targets }),
);

export const customLogLevel = (
	_req: Request,
	res: Response,
	err: Error | undefined,
) => {
	if (err || res.statusCode >= 500) return "error";
	if (res.statusCode >= 400) return "warn";
	return "info";
};
