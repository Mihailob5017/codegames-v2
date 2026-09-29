import { z } from "zod";
import type { Controller } from "../types/shared.types.ts";
import { createUserValidation } from "./admin.validation.ts";

// TODO: Implement a dedicated error-handling middleware
export const healthCheck: Controller = async (req, res) => {
	res.status(200).json({ status: "ok" });
};

export const createUser: Controller = async (req, res) => {
	try {
		// validate user via zod
		const validatedUser = createUserValidation(req.body);
		res.json(validatedUser);
		// call createUser service
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({ errors: error.issues });
			return;
		}
		res.status(500).json({ error: "Internal server error" });
	}
};
