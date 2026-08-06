import type { QueryClient } from "@tanstack/svelte-query";
import { orpc } from "$lib/orpc";

export function invalidateToolCaches(queryClient: QueryClient) {
	queryClient.invalidateQueries({ queryKey: orpc.tools.list.key() });
	queryClient.invalidateQueries({ queryKey: orpc.tools.get.key() });
	queryClient.invalidateQueries({ queryKey: orpc.tools.byFounder.key() });
	queryClient.invalidateQueries({ queryKey: orpc.tools.listAdopters.key() });
}
