import { type Request, type Response, type NextFunction } from "express";
import { DatabaseError } from "pg";
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
		response: "Resource with that ID not found",
	},
	CONFLICT: {
		statusCode: 409,
		response: "Resource already exists",
	},
	CONTENT_TOO_LARGE: {
		statusCode: 413,
		response: "The request body is too large.",
	},
} as const;

const PG_ERROR_MAP: Partial<Record<string, ErrorCode>> = {
	"23505": "CONFLICT",
	"23503": "VALIDATION_ERROR",
	"23502": "VALIDATION_ERROR",
};

// Express's body parser throws errors tagged with an HTTP status (malformed JSON
// → 400, oversized body → 413). Map the 4xx ones instead of hiding them as 500s.
const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
	400: "VALIDATION_ERROR",
	413: "CONTENT_TOO_LARGE",
};

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

const asDatabaseError = (err: unknown): DatabaseError | undefined => {
	if (err instanceof DatabaseError) return err;
	if (err instanceof Error && err.cause instanceof DatabaseError)
		return err.cause;
	return undefined;
};

const isDatabaseError = (err: unknown): DatabaseError | null => {
	if (err instanceof DatabaseError) return err;

	if (err instanceof Error && err.cause instanceof DatabaseError)
		return err.cause;

	return null;
};

// const asClientHttpStatus = (err: unknown): number | undefined => {
// 	if (!(err instanceof Error)) return undefined;
// 	const status =
// 		(err as { statusCode?: unknown }).statusCode ??
// 		(err as { status?: unknown }).status;
// 	return typeof status === "number" && status >= 400 && status < 500
// 		? status
// 		: undefined;
// };

const isClientHttpStatus = (err: unknown): number | null => {
	if (!(err instanceof Error)) return null;

	// `unknown`, not `number`: libraries set these fields however they like.
	const { statusCode, status } = err as {
		statusCode?: unknown;
		status?: unknown;
	};
	const httpStatus = statusCode ?? status;

	if (typeof httpStatus !== "number") return null;

	const isClientError = httpStatus >= 400 && httpStatus < 500;
	if (!isClientError) return null;

	return httpStatus;
};

const normalizeError = (err: unknown): AppError => {
	if (err instanceof AppError) return err;

	if (err instanceof z.ZodError) {
		return new AppError("VALIDATION_ERROR", {
			message: "Invalid request data",
			details: err.issues.map((issue) => ({
				path: issue.path,
				message: issue.message,
			})),
			cause: err,
		});
	}

	const dbError = isDatabaseError(err);
	if (dbError) {
		const errorCode =
			(dbError.code && PG_ERROR_MAP[dbError.code]) || "INTERNAL_ERROR";

		const dbErrorDetails = (
			dbError: DatabaseError,
		): Record<string, any> | null => {
			if (errorCode === "INTERNAL_ERROR") return null;
			return { constraint: dbError.constraint, column: dbError.column };
		};

		return new AppError(errorCode, {
			message: `Database error: ${dbError.message}`,
			details: dbErrorDetails(dbError),
			cause: err,
		});
	}

	const errorStatus = isClientHttpStatus(err);
	if (errorStatus) {
		return new AppError(
			HTTP_STATUS_TO_CODE[errorStatus] ?? "VALIDATION_ERROR",
			{
				message: "Request could not be processed",
				cause: err,
			},
		);
	}

	return new AppError("INTERNAL_ERROR", {
		message: "An unexpected error occurred",
		cause: err,
	});
};

export const errorHandler = (
	err: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (res.headersSent) {
		_next(err);
		return;
	}

	const appError = normalizeError(err);
	const level = appError.statusCode >= 500 ? "error" : "warn";

	req.log[level]({ err: appError }, appError.message);

	res.status(appError.statusCode).json(toResponseBody(appError));
};
