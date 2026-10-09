import { timestamp } from "../helpers/util.ts";

import type { ErrorCode, AppErrorOptions } from "./error.types.ts";
import { ERRORS } from "./error.constants.ts";

import { type HttpStatusCodes } from "../types/shared.types.ts";

export class AppError extends Error {
	code: ErrorCode;
	statusCode: HttpStatusCodes[keyof HttpStatusCodes];
	response: string;
	details?: unknown;
	timestamp: Date;

	constructor(code: ErrorCode, { message, details, cause }: AppErrorOptions) {
		super(message, { cause });

		this.name = "AppError";
		this.code = code;
		this.statusCode = ERRORS[code].statusCode;
		this.response = ERRORS[code].response;
		this.details = details;
		this.timestamp = timestamp();
	}
}
