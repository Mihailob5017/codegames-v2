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
