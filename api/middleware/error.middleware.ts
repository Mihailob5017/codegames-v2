import type { ErrorRequestHandler } from "express";

type HttpError = Error & { status?: number; expose?: boolean };

const isClientError = (err: HttpError): boolean =>
	typeof err.status === "number" && err.status >= 400 && err.status < 500;

// Last line of defence: always answers in JSON and never sends stack traces or internal
// messages to the client. Errors from express.json() (malformed JSON, payload too large)
// carry a 4xx status and `expose: true`, meaning their message is safe to return.
export const errorHandler: ErrorRequestHandler = (
	err: HttpError,
	_req,
	res,
	next,
) => {
	// A response is already on the wire; let Express close the connection.
	if (res.headersSent) {
		next(err);
		return;
	}

	if (isClientError(err)) {
		res
			.status(err.status!)
			.json({ error: err.expose ? err.message : "Bad request" });
		return;
	}

	console.error(err);
	res.status(500).json({ error: "Internal server error" });
};
