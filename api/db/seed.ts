import { db } from "../config/db.config.ts";
import { users } from "./schema.ts";

const seedUsers = [
	{ email: "alice@example.com", username: "alice", name: "Alice" },
	{ email: "bob@example.com", username: "bob", name: "Bob" },
];

const seed = async () => {
	// Idempotent: re-running the seed must not fail on the unique email index.
	const inserted = await db
		.insert(users)
		.values(seedUsers)
		.onConflictDoNothing({ target: users.email })
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
