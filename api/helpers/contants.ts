import type { ErrorCode } from "../types/error.types.ts";
import type { HttpStatusCodes } from "../types/shared.types.ts";

const BASE_API_ROUTE = "/api";
const VERSION = "v1";

export const API_ROUTE = `${BASE_API_ROUTE}/${VERSION}`;

export const HTTPStatusCodes: HttpStatusCodes = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	CONTENT_TOO_LARGE: 413,
	INTERNAL_SERVER_ERROR: 500,
};

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
