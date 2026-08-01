import { env } from "@matilha-builders/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// biome-ignore lint/performance/noNamespaceImport: drizzle needs the whole schema module shape; named imports break better-auth's additionalFields type inference downstream.
import * as schema from "./schema";

export function createDb() {
	const sql = neon(env.DATABASE_URL);
	return drizzle(sql, { schema });
}

export const db = createDb();
