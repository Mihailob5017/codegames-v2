import type { ERRORS } from "./error.constants.ts";

export type ErrorCode = keyof typeof ERRORS;

export type AppErrorOptions = {
	message: string;
	details?: unknown;
	cause?: unknown;
};

export type ErrorResponseBody = {
	code: ErrorCode;
	statusCode: number;
	response: string;
	message: string;
	details?: unknown;
	timestamp: Date;
};
