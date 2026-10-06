import { getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { users, type User } from "../db/schema.ts";
import { AdminRepository } from "./admin.repository.ts";

// A stand-in for the pg pool: drizzle builds and maps queries for real, so the tests
// check the SQL that would reach Postgres without needing a database.
const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock(import("../config/db.config.ts"), async () => {
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.ts");
	return { db: drizzle({ client: client as never, schema }) };
});

const storedUser = (): User => ({
	id: 1,
	username: "player_one",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@example.com",
	password: "secret1",
	isAdmin: false,
	isVerified: false,
	score: 0,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
});

// Selects and RETURNING run in pg's array row mode, with values in column order.
const columns = Object.keys(getTableColumns(users)) as (keyof User)[];
const asRow = (user: User) => columns.map((column) => user[column]);
const respondWith = (...rows: User[]) =>
	client.query.mockResolvedValueOnce({ rows: rows.map(asRow) });

const lastQuery = () => {
	const [config, params] = client.query.mock.lastCall!;
	return { text: config.text as string, params };
};

beforeEach(() => {
	client.query.mockReset();
});

describe("AdminRepository.getUserById", () => {
	it("selects the user by id", async () => {
		respondWith(storedUser());

		const user = await AdminRepository.getUserById(1);

		expect(user).toEqual(storedUser());
		const { text, params } = lastQuery();
		expect(text).toMatch(/^select .+ from "users" where "users"."id" = \$1$/);
		expect(params).toEqual([1]);
	});

	it("returns null when no row matches", async () => {
		respondWith();

		expect(await AdminRepository.getUserById(999)).toBeNull();
	});
});

describe("AdminRepository.getAllUsers", () => {
	it("selects every user", async () => {
		respondWith(storedUser(), { ...storedUser(), id: 2 });

		const result = await AdminRepository.getAllUsers();

		expect(result.map((user) => user.id)).toEqual([1, 2]);
		const { text, params } = lastQuery();
		expect(text).toMatch(/^select .+ from "users"$/);
		expect(params).toEqual([]);
	});
});

describe("AdminRepository.createUser", () => {
	it("inserts the input and returns the stored row", async () => {
		respondWith(storedUser());
		const { username, firstName, lastName, email, password } = storedUser();

		const created = await AdminRepository.createUser({
			username,
			firstName,
			lastName,
			email,
			password,
		});

		expect(created).toEqual(storedUser());
		const { text, params } = lastQuery();
		expect(text).toMatch(/^insert into "users" .+ returning /);
		expect(params).toEqual(
			expect.arrayContaining([username, firstName, lastName, email, password]),
		);
	});
});

describe("AdminRepository.deleteUser", () => {
	it("deletes only the user with the given id", async () => {
		client.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

		await AdminRepository.deleteUser(7);

		const { text, params } = lastQuery();
		expect(text).toBe('delete from "users" where "users"."id" = $1');
		expect(params).toEqual([7]);
	});
});

// Drizzle wraps driver errors, so pg details such as the 23505 unique-violation code
// live on `cause`. Anything that maps database errors to HTTP statuses must look there.
it("propagates database errors with the pg error as the cause", async () => {
	const pgError = Object.assign(new Error("duplicate key"), { code: "23505" });
	client.query.mockRejectedValueOnce(pgError);

	await expect(AdminRepository.getAllUsers()).rejects.toMatchObject({
		cause: { code: "23505" },
	});
});
