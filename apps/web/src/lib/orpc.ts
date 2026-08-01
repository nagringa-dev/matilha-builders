import type { AppRouterClient } from "@matilha-builders/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/svelte-query";
import { toast } from "$lib/components/ui/sonner/index.js";

declare module "@tanstack/svelte-query" {
	interface Register {
		mutationMeta: {
			skipErrorToast?: boolean;
		};
		queryMeta: {
			skipErrorToast?: boolean;
		};
	}
}

const FALLBACK_ERROR_MESSAGE = "Algo deu errado. Tenta de novo.";

export const queryClient = new QueryClient({
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			console.error(`Error: ${error.message}`);
			if (mutation.meta?.skipErrorToast) {
				return;
			}
			toast.error(error.message || FALLBACK_ERROR_MESSAGE);
		},
	}),
	queryCache: new QueryCache({
		onError: (error, query) => {
			console.error(`Error: ${error.message}`);
			if (query.meta?.skipErrorToast) {
				return;
			}
			// Only toast when there's nothing already on screen for this query —
			// a background refetch failure shouldn't interrupt a page that's
			// still showing the last good data.
			if (query.state.data !== undefined) {
				return;
			}
			toast.error(error.message || FALLBACK_ERROR_MESSAGE);
		},
	}),
});

export const link = new RPCLink({
	fetch(_url, options) {
		return fetch(_url, {
			...options,
			credentials: "include",
		});
	},
	url: () => {
		if (typeof window === "undefined") {
			throw new Error("This link is not allowed on the server side.");
		}

		return `${window.location.origin}/rpc`;
	},
});

export const client: AppRouterClient =
	globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
