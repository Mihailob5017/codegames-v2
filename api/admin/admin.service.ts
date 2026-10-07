import type { CreateUserInput } from "./admin.validation.ts";
import type { User } from "../db/schema.ts";
import { AdminRepository } from "./admin.repository.ts";
import { AppError } from "../middleware/error.middleware.ts";
import { HTTPStatusCodes } from "../helpers/contants.ts";

// The only user fields the API may expose; password, isAdmin and timestamps stay server-side.
type UserResponse = Pick<
	User,
	| "id"
	| "firstName"
	| "lastName"
	| "email"
	| "username"
	| "score"
	| "isVerified"
>;

const toUserResponse = (user: User): UserResponse => {
	const { id, firstName, lastName, email, username, score, isVerified } = user;

	return { id, firstName, lastName, email, username, score, isVerified };
};

export const AdminService = {
	deleteUser: async (userId: number): Promise<void> => {
		// TODO: Nothing was deleted error
		await AdminRepository.deleteUser(userId);
	},

	createUser: async (userData: CreateUserInput): Promise<UserResponse> => {
		const createdUser = await AdminRepository.createUser(userData);
		return toUserResponse(createdUser);
	},

	getUserById: async (userId: number): Promise<UserResponse> => {
		const user = await AdminRepository.getUserById(userId);
		if (!user)
			throw new AppError("NOT_FOUND", {
				message: `User with the given ID doesn't exist`,
			});
		return toUserResponse(user);
	},

	getAllUsers: async (): Promise<UserResponse[]> => {
		const users = await AdminRepository.getAllUsers();
		return users.map(toUserResponse);
	},
};
