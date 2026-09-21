import z from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (env: NodeJS.ProcessEnv): EnvConfig => {
	return envSchema.parse(env);
};
