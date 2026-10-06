import type { CreateUserInput } from "./admin.validation.ts";
import type { User } from "../db/schema.ts";
import { AdminRepository } from "./admin.repository.ts";

// The only user fields the API may expose; password, isAdmin and timestamps stay server-side.
type UserResponse = Pick<
	User,
	"id" | "firstName" | "lastName" | "email" | "username" | "score" | "isVerified"
>;

const toUserResponse = (user: User): UserResponse => {
	const { id, firstName, lastName, email, username, score, isVerified } = user;

	return { id, firstName, lastName, email, username, score, isVerified };
};

export const AdminService = {
	deleteUser: async (userId: number): Promise<void> => {
		try {
			await AdminRepository.deleteUser(userId);
		} catch (error) {
			throw new Error("Failed to delete user", { cause: "not-found" });
		}
	},

	createUser: async (userData: CreateUserInput): Promise<UserResponse> => {
		const createdUser = await AdminRepository.createUser(userData);
		return toUserResponse(createdUser);
	},

	getUserById: async (userId: number): Promise<UserResponse> => {
		const user = await AdminRepository.getUserById(userId);
		if (!user) throw new Error("User not found", { cause: "not-found" });
		return toUserResponse(user);
	},

	getAllUsers: async (): Promise<UserResponse[]> => {
		const users = await AdminRepository.getAllUsers();
		return users.map(toUserResponse);
	},
};
