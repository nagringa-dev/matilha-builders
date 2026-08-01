import "./lib/orpc.server";
import { auth } from "@matilha-builders/auth";
import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export const handle: Handle = ({ event, resolve }) => {
	const authInstance = auth;

	return svelteKitHandler({
		auth: authInstance,
		building,
		event,
		resolve,
	});
};
