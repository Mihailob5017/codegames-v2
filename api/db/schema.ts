import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: serial("id").primaryKey(),
		email: text("email").notNull(),
		username: text("username"),
		name: text("name"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("users_email_key").on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
