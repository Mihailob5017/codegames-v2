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
