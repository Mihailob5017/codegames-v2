import type { Controller } from "../types/shared.types.ts";
import { createUserValidation } from "./admin.validation.ts";
import { AdminService } from "./admin.service.ts";
import { AppError } from "../error/app-error.ts";
import { HTTPStatusCodes } from "../helpers/contants.ts";

export const healthCheck: Controller = async (req, res, next) => {
	res.status(HTTPStatusCodes.OK).json({ status: "ok" });
};

export const createUser: Controller = async (req, res, next) => {
	const validatedUser = createUserValidation(req.body);

	const createdUser = await AdminService.createUser(validatedUser);

	res.status(HTTPStatusCodes.CREATED).json(createdUser);
};

export const deleteUser: Controller = async (req, res, next) => {
	const userId = Number(req.params.id);

	if (!Number.isInteger(userId) || userId <= 0) {
		throw new AppError("VALIDATION_ERROR", {
			message: `Invalid user ID`,
			details: { fields: ["id"], reason: "User ID must be a positive integer" },
		});
	}

	await AdminService.deleteUser(userId);

	res.status(HTTPStatusCodes.OK).json({ message: "User deleted successfully" });
};

export const getAllUsers: Controller = async (req, res, next) => {
	const users = await AdminService.getAllUsers();

	res.status(HTTPStatusCodes.OK).json(users);
};

export const getUser: Controller = async (req, res, next) => {
	const userId = Number(req.params.id);

	if (!Number.isInteger(userId) || userId <= 0) {
		throw new AppError("VALIDATION_ERROR", {
			message: `Invalid user ID`,
			details: { fields: ["id"], reason: "User ID must be a positive integer" },
		});
	}
	const user = await AdminService.getUserById(userId);

	res.status(HTTPStatusCodes.OK).json(user);
};
