import { DatabaseError } from "pg";
import { z } from "zod";

import { AppError } from "../shared/app-error.shared.ts";
import { HTTP_STATUS_TO_CODE, PG_ERROR_MAP } from "../helpers/contants.ts";
import type { ErrorResponseBody } from "../types/error.types.ts";

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

const isDatabaseError = (err: unknown): DatabaseError | null => {
	if (err instanceof DatabaseError) return err;

	if (err instanceof Error && err.cause instanceof DatabaseError)
		return err.cause;

	return null;
};

const isClientHttpStatus = (err: unknown): number | null => {
	if (!(err instanceof Error)) return null;

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

		// The pg message can name tables or echo input, so it stays on `cause` for the logs.
		return new AppError(errorCode, {
			message:
				errorCode === "INTERNAL_ERROR"
					? "An unexpected error occurred"
					: "The request violates a database constraint",
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
export { toResponseBody, isDatabaseError, isClientHttpStatus, normalizeError };
