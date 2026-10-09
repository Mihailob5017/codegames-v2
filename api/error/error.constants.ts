import type { ErrorCode } from "./error.types.ts";

export const ERRORS = {
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

export const PG_ERROR_MAP: Partial<Record<string, ErrorCode>> = {
	"23505": "CONFLICT",
	"23503": "VALIDATION_ERROR",
	"23502": "VALIDATION_ERROR",
};

export const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
	400: "VALIDATION_ERROR",
	413: "CONTENT_TOO_LARGE",
};
