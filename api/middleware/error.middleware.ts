import { type Request, type Response, type NextFunction } from "express";
import { type HttpStatusCodes } from "../types/shared.types.ts";
import { timestamp } from "../helpers/util.ts";
import { z } from "zod";

const ERRORS = {
	VALIDATION_ERROR: {
		statusCode: 400,
		response: "Some fields are invalid.Please check them and try again",
	},
	INTERNAL_ERROR: {
		statusCode: 500,
		response: "An internal server error occurred. Please try again later.",
	},
	NOT_FOUND: {
		statusCode: 404,
		response: "Resource with that ID not found", // TODO: Think of something more robust
	},
} as const;

export type ErrorCode = keyof typeof ERRORS;

type AppErrorOptions = {
	message: string;
	details?: unknown;
	cause?: unknown;
};

type ErrorResponseBody = {
	code: ErrorCode;
	statusCode: number;
	response: string;
	message: string;
	details?: unknown;
	timestamp: Date;
};

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

const toResponseBody = (error: AppError): ErrorResponseBody => {
	const responseBody: ErrorResponseBody = {
		code: error.code,
		response: error.response,
		message: error.message,
		details: error.details,
		timestamp: error.timestamp,
		statusCode: error.statusCode,
	};

	return responseBody;
};

const normalizeError = (err: unknown): AppError => {
	if (err instanceof AppError) return err;

	if (err instanceof z.ZodError) {
		new AppError("VALIDATION_ERROR", {
			message: err.message,
			details: { ...z.flattenError(err) },
		});
	}

	return new AppError("INTERNAL_ERROR", {
		message: "An unexpected error occurred",
		cause: err,
	});
};

export const errorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (res.headersSent) {
		_next(err);
		return;
	}

	const appError = normalizeError(err);

	res.status(appError.statusCode).json(toResponseBody(appError));
};
