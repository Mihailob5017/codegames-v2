import { schemaErrors } from "./../helpers/errors.ts";
import { z } from "zod";

const createUserSchema = z.object({
	username: z
		.string(schemaErrors.mustBeType("username", "string"))
		.trim()
		.min(3, schemaErrors.length("username", 3, 30))
		.max(30, schemaErrors.length("username", 3, 30)),
	firstName: z
		.string(schemaErrors.mustBeType("firstName", "string"))
		.trim()
		.min(1, schemaErrors.length("firstName", 1, 50))
		.max(50, schemaErrors.length("firstName", 1, 50)),
	lastName: z
		.string(schemaErrors.mustBeType("lastName", "string"))
		.trim()
		.min(1, schemaErrors.length("lastName", 1, 50))
		.max(50, schemaErrors.length("lastName", 1, 50)),
	email: z.email(schemaErrors.mustBeType("email", "valid email")),
	password: z
		.string(schemaErrors.mustBeType("password", "string"))
		.min(6, schemaErrors.length("password", 6, 50))
		.max(50, schemaErrors.length("password", 6, 50)),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const createUserValidation = (data: unknown) => {
	return createUserSchema.parse(data);
};
