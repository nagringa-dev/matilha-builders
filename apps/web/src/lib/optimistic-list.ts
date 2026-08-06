import type { QueryClient, QueryKey } from "@tanstack/svelte-query";

export function optimisticCache<T>(
	queryClient: QueryClient,
	queryKey: () => QueryKey
) {
	return {
		patch(updater: (data: T) => T) {
			queryClient.setQueryData<T>(queryKey(), (current) =>
				current ? updater(current) : current
			);
		},
		restore(snapshot: T | undefined) {
			if (snapshot) {
				queryClient.setQueryData(queryKey(), snapshot);
			}
		},
		async snapshotAndCancel() {
			await queryClient.cancelQueries({ queryKey: queryKey() });
			return queryClient.getQueryData<T>(queryKey());
		},
	};
}
