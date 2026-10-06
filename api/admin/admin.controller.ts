import { z } from "zod";
import type { Controller } from "../types/shared.types.ts";
import { createUserValidation } from "./admin.validation.ts";
import { AdminService } from "./admin.service.ts";
export const healthCheck: Controller = async (req, res) => {
	res.status(200).json({ status: "ok" });
};

export const createUser: Controller = async (req, res) => {
	try {
		// validate user via zod
		const validatedUser = createUserValidation(req.body);

		const createdUser = await AdminService.createUser(validatedUser);

		res.status(201).json(createdUser);
	} catch (error) {
		if (error instanceof z.ZodError) {
			res.status(400).json({ errors: error.issues });
			return;
		}
		res.status(500).json({ error: "Internal server error" });
	}
};

export const deleteUser: Controller = async (req, res) => {
	const userId = Number(req.params.id);

	try {
		if (!Number.isInteger(userId) || userId <= 0) {
			throw new Error("A valid user ID is required", { cause: "invalid-id" });
		}

		await AdminService.deleteUser(userId);

		res.status(200).json({ message: "User deleted successfully" });
	} catch (error) {
		if (error instanceof Error) {
			if (error.cause === "invalid-id") {
				res.status(400).json({ error: error.message });
				return;
			}
			if (error.cause === "not-found") {
				res.status(404).json({ error: error.message });
				return;
			}
		}
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getAllUsers: Controller = async (req, res) => {
	try {
		const users = await AdminService.getAllUsers();

		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: "Something went wrong with the server" });
	}
};

export const getUser: Controller = async (req, res) => {
	try {
		const userId = Number(req.params.id);

		if (!Number.isInteger(userId) || userId <= 0) {
			throw new Error("A valid user ID is required", { cause: "invalid-id" });
		}
		const user = await AdminService.getUserById(userId);

		res.status(200).json(user);
	} catch (error) {
		if (error instanceof Error) {
			if (error.cause === "invalid-id") {
				res.status(400).json({ error: error.message });
				return;
			}
			if (error.cause === "not-found") {
				res.status(404).json({ error: error.message });
				return;
			}
		}
		res.status(500).json({ error: "Internal server error" });
	}
};
