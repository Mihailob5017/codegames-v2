import type { Request, Response, NextFunction } from "express";

export type Controller = (
	req: Request,
	res: Response,
	next: NextFunction,
) => Promise<void>;

export type HttpStatusCodes = {
	OK: 200;
	CREATED: 201;
	NO_CONTENT: 204;
	BAD_REQUEST: 400;
	UNAUTHORIZED: 401;
	FORBIDDEN: 403;
	NOT_FOUND: 404;
	CONFLICT: 409;
	CONTENT_TOO_LARGE: 413;
	INTERNAL_SERVER_ERROR: 500;
};
