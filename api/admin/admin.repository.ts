import { eq } from "drizzle-orm";
import { db } from "../config/db.config.ts";
import { users } from "../db/schema.ts";
import type { CreateUserInput } from "./admin.validation.ts";
import type { User } from "../db/schema.ts";
export const AdminRepository = {
	deleteUser: async (userId: number): Promise<void> => {
		await db.delete(users).where(eq(users.id, userId));
	},

	createUser: async (userData: CreateUserInput): Promise<User> => {
		const [createdUser] = await db.insert(users).values(userData).returning();

		return createdUser;
	},

	getUserById: async (userId: number): Promise<User | null> => {
		const [user] = await db.select().from(users).where(eq(users.id, userId));

		if (user) return user;
		return null;
	},

	getAllUsers: async (): Promise<User[]> => {
		const response = await db.select().from(users);

		return response;
	},
};
