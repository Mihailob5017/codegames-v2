import { db } from "../config/db.config.ts";
import { users, type NewUser } from "./schema.ts";

const seedUsers: NewUser[] = [
	{
		username: "mixailo146",
		firstName: "Mihailo",
		lastName: "Boskovic",
		email: "mixailo146@example.com",
		password: "password",
		isAdmin: true,
		isVerified: true,
		score: 0,
	},
	{
		username: "ximperl",
		firstName: "Ksenija",
		lastName: "User",
		email: "ximperl@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 0,
	},
	{
		username: "john_doe",
		firstName: "John",
		lastName: "Doe",
		email: "john_doe@example.com",
		password: "password",
		isAdmin: false,
		isVerified: false,
		score: 0,
	},
	{
		username: "ada_codes",
		firstName: "Ada",
		lastName: "Lovelace",
		email: "ada_codes@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 1820,
	},
	{
		username: "grace_h",
		firstName: "Grace",
		lastName: "Hopper",
		email: "grace_h@example.com",
		password: "password",
		isAdmin: true,
		isVerified: true,
		score: 2450,
	},
	{
		username: "alan_t",
		firstName: "Alan",
		lastName: "Turing",
		email: "alan_t@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 3100,
	},
	{
		username: "linus_t",
		firstName: "Linus",
		lastName: "Torvalds",
		email: "linus_t@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 960,
	},
	{
		username: "margaret_h",
		firstName: "Margaret",
		lastName: "Hamilton",
		email: "margaret_h@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 2450,
	},
	{
		username: "dennis_r",
		firstName: "Dennis",
		lastName: "Ritchie",
		email: "dennis_r@example.com",
		password: "password",
		isAdmin: false,
		isVerified: false,
		score: 0,
	},
	{
		username: "barbara_l",
		firstName: "Barbara",
		lastName: "Liskov",
		email: "barbara_l@example.com",
		password: "password",
		isAdmin: false,
		isVerified: true,
		score: 410,
	},
];

const seed = async () => {
	const inserted = await db
		.insert(users)
		.values(seedUsers)
		.onConflictDoNothing()
		.returning({ id: users.id, email: users.email });

	console.log(`Seeded ${inserted.length} user(s).`);

	const total = await db.$count(users);
	console.log(`users table now holds ${total} row(s).`);
};

try {
	await seed();
} catch (error) {
	console.error("Seed failed:", error);
	process.exitCode = 1;
} finally {
	await db.$client.end();
}
