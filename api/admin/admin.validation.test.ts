import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createUserValidation } from "./admin.validation.ts";

const validUser = (
	overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
	username: "player_one",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "secret1",
	...overrides,
});

// Returns the validation issues for `data`, failing the test if it unexpectedly passes.
const issuesFor = (data: unknown) => {
	try {
		createUserValidation(data);
	} catch (error) {
		if (error instanceof z.ZodError) return error.issues;
		throw error;
	}
	throw new Error("Expected validation to fail, but it passed");
};

const messagesFor = (data: unknown) => issuesFor(data).map((i) => i.message);

describe("createUserValidation", () => {
	it("returns a valid user unchanged", () => {
		const input = validUser();

		expect(createUserValidation(input)).toEqual(input);
	});

	it("strips fields that are not part of the schema, so clients cannot set privileged flags", () => {
		const result = createUserValidation(
			validUser({ isAdmin: true, isVerified: true, score: 9999, id: 1 }),
		);

		expect(result).not.toHaveProperty("isAdmin");
		expect(result).not.toHaveProperty("isVerified");
		expect(result).not.toHaveProperty("score");
		expect(result).not.toHaveProperty("id");
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["a string", "ada"],
		["an array", [validUser()]],
	])("rejects %s as the payload", (_label, payload) => {
		expect(() => createUserValidation(payload)).toThrow(z.ZodError);
	});

	it("reports every invalid field at once rather than stopping at the first", () => {
		const issues = issuesFor({ username: "ab", email: "nope" });

		expect(issues.map((i) => i.path[0])).toEqual(
			expect.arrayContaining([
				"username",
				"firstName",
				"lastName",
				"email",
				"password",
			]),
		);
	});

	describe.each([
		{ field: "username", min: 3, max: 30 },
		{ field: "firstName", min: 1, max: 50 },
		{ field: "lastName", min: 1, max: 50 },
		{ field: "password", min: 6, max: 50 },
	])("$field", ({ field, min, max }) => {
		const lengthMessage = `${field} must be between ${min} and ${max} characters`;

		it(`accepts the minimum length (${min})`, () => {
			const input = validUser({ [field]: "a".repeat(min) });

			expect(createUserValidation(input)).toMatchObject({
				[field]: "a".repeat(min),
			});
		});

		it(`accepts the maximum length (${max})`, () => {
			const input = validUser({ [field]: "a".repeat(max) });

			expect(createUserValidation(input)).toMatchObject({
				[field]: "a".repeat(max),
			});
		});

		it(`rejects ${min - 1} characters`, () => {
			expect(messagesFor(validUser({ [field]: "a".repeat(min - 1) }))).toEqual([
				lengthMessage,
			]);
		});

		it(`rejects ${max + 1} characters`, () => {
			expect(messagesFor(validUser({ [field]: "a".repeat(max + 1) }))).toEqual([
				lengthMessage,
			]);
		});

		it("is required", () => {
			const { [field]: _omitted, ...rest } = validUser();

			expect(messagesFor(rest)).toEqual([`${field} must be a string`]);
		});

		it.each([
			["a number", 12345],
			["a boolean", true],
			["an object", { value: "abc" }],
		])("rejects %s", (_label, value) => {
			expect(messagesFor(validUser({ [field]: value }))).toEqual([
				`${field} must be a string`,
			]);
		});
	});

	describe.each([
		{ field: "username", min: 3, max: 30 },
		{ field: "firstName", min: 1, max: 50 },
		{ field: "lastName", min: 1, max: 50 },
	])("$field whitespace", ({ field, min, max }) => {
		it("trims surrounding whitespace", () => {
			const input = validUser({ [field]: "  ada_l  " });

			expect(createUserValidation(input)).toMatchObject({ [field]: "ada_l" });
		});

		it("rejects a whitespace-only value", () => {
			expect(messagesFor(validUser({ [field]: " ".repeat(max) }))).toEqual([
				`${field} must be between ${min} and ${max} characters`,
			]);
		});

		it("measures length after trimming", () => {
			const padded = ` ${"a".repeat(max)} `;

			expect(
				createUserValidation(validUser({ [field]: padded })),
			).toMatchObject({ [field]: "a".repeat(max) });
		});
	});

	it("keeps password whitespace, since it is part of the secret", () => {
		const password = "  secret  ";

		expect(createUserValidation(validUser({ password }))).toMatchObject({
			password,
		});
	});

	describe("email", () => {
		it.each(["ada@example.com", "ada.lovelace+test@sub.example.co.uk"])(
			"accepts %s",
			(email) => {
				expect(createUserValidation(validUser({ email }))).toMatchObject({
					email,
				});
			},
		);

		it.each(["not-an-email", "ada@", "@example.com", "ada @example.com", ""])(
			"rejects %j",
			(email) => {
				expect(messagesFor(validUser({ email }))).toEqual([
					"email must be a valid email",
				]);
			},
		);

		it("is required", () => {
			const { email: _omitted, ...rest } = validUser();

			expect(issuesFor(rest)).toEqual([
				expect.objectContaining({ path: ["email"] }),
			]);
		});
	});
});
