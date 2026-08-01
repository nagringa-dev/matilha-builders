import { auth } from "@matilha-builders/auth";

export interface CreateContextOptions {
	headers: Headers;
}

export async function createContext({ headers }: CreateContextOptions) {
	const session = await auth.api.getSession({ headers });
	return {
		auth: null,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
