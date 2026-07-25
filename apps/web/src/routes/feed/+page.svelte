<script lang="ts">
	import {
		createInfiniteQuery,
		createMutation,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { authClient } from "$lib/auth-client";
	import CheckInItem from "$lib/components/matilha/check-in-item.svelte";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { orpc } from "$lib/orpc";

	const sessionQuery = authClient.useSession();
	const currentUserId = $derived($sessionQuery.data?.user.id ?? null);

	const queryClient = useQueryClient();

	function feedInfiniteOptions() {
		return {
			getNextPageParam: (lastPage: { nextCursor?: number }) =>
				lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor }),
		};
	}

	const feedQuery = createInfiniteQuery(() =>
		orpc.checkIns.listFeed.infiniteOptions(feedInfiniteOptions())
	);

	const checkIns = $derived(
		feedQuery.data?.pages.flatMap((page) => page.items) ?? []
	);

	type FeedData = NonNullable<typeof feedQuery.data>;

	function feedQueryKey() {
		return orpc.checkIns.listFeed.infiniteKey(feedInfiniteOptions());
	}

	function patchCheckIn(
		checkInId: string,
		patch: Partial<FeedData["pages"][number]["items"][number]>
	) {
		queryClient.setQueryData<FeedData>(feedQueryKey(), (old) =>
			old
				? {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							items: page.items.map((item) =>
								item.id === checkInId ? { ...item, ...patch } : item
							),
						})),
					}
				: old
		);
	}

	const dismissVote = createMutation(() => ({
		...orpc.checkIns.dismissVote.mutationOptions(),
		onError: (_error, input) => {
			patchCheckIn(input.checkInId, { hasVoted: false });
		},
		onMutate: (input) => {
			const current = checkIns.find((c) => c.id === input.checkInId);
			patchCheckIn(input.checkInId, {
				hasVoted: true,
				voteCount: (current?.voteCount ?? 0) + 1,
			});
		},
		onSuccess: (result, input) => {
			patchCheckIn(input.checkInId, {
				dismissedAt: result.dismissed ? new Date() : null,
				voteCount: result.voteCount,
			});
		},
	}));
</script>

<div class="mx-auto max-w-2xl px-4 py-8 md:px-6">
	<div class="mb-6 border-border border-b pb-5">
		<h1 class="text-2xl font-bold tracking-tight">Feed</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Os wins e os fails de todo mundo
		</p>
	</div>
	{#if feedQuery.isLoading}
		<Loader
			size="sm"
			subtitle="Buscando os últimos check-ins"
			title="Carregando o feed..."
		/>
	{:else if !checkIns.length}
		<p class="text-sm text-muted-foreground">
			Ninguém postou ainda essa semana. Começa tu.
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each checkIns as checkIn, index (checkIn.id)}
				<CheckInItem
					{checkIn}
					{currentUserId}
					{index}
					isVoting={dismissVote.isPending &&
						dismissVote.variables?.checkInId === checkIn.id}
					onDismissVote={(checkInId) => dismissVote.mutate({ checkInId })}
				/>
			{/each}
		</div>
		<InfiniteScrollSentinel
			hasNextPage={feedQuery.hasNextPage}
			isFetchingNextPage={feedQuery.isFetchingNextPage}
			onLoadMore={() => feedQuery.fetchNextPage()}
		/>
	{/if}
</div>
