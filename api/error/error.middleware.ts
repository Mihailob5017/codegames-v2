import type { Request, Response, NextFunction } from "express";

import { normalizeError, toResponseBody } from "./error.normalize.ts";
import { AppError } from "./app-error.ts";

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

export const unknownRouteHandler = (
	req: Request,
	res: Response,
	_next: NextFunction,
) => {
	const appError = new AppError("NOT_FOUND", {
		message: "The requested route does not exist",
	});
	const level = appError.statusCode >= 500 ? "error" : "warn";

	req.log[level]({ err: appError }, appError.message);

	res.status(appError.statusCode).json(toResponseBody(appError));
};
