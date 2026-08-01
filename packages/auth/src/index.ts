import { createDb } from "@matilha-builders/db";
// biome-ignore lint/performance/noNamespaceImport: drizzleAdapter needs the whole schema module shape; named imports break better-auth's additionalFields type inference.
import * as schema from "@matilha-builders/db/schema/auth";
import { founder } from "@matilha-builders/db/schema/matilha";
import { env } from "@matilha-builders/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
	const db = createDb();

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		database: drizzleAdapter(db, {
			provider: "pg",

			schema,
		}),
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await db.insert(founder).values({
							userId: user.id,
						});
					},
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			// biome-ignore lint/suspicious/useAwait: better-auth's sendResetPassword type requires a function that returns a Promise.
			sendResetPassword: async ({ user, url }) => {
				console.log(
					`[auth] Link de redefinição de senha para ${user.email}: ${url}`
				);
			},
		},
		plugins: [],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.CORS_ORIGIN],
		user: {
			additionalFields: {
				approvalStatus: {
					defaultValue: "pending",
					input: false,
					type: "string",
				},
				role: {
					defaultValue: "founder",
					input: false,
					type: "string",
				},
			},
		},
	});
}

export const auth = createAuth();
