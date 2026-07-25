<script lang="ts">
	import { createInfiniteQuery } from "@tanstack/svelte-query";
	import FounderCard from "$lib/components/matilha/founder-card.svelte";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { orpc } from "$lib/orpc";

	const foundersQuery = createInfiniteQuery(() =>
		orpc.founders.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor }),
		})
	);

	const founders = $derived(
		foundersQuery.data?.pages.flatMap((page) => page.items) ?? []
	);
</script>

<div class="px-4 py-8 md:px-6">
	<div
		class="mb-6 flex items-end justify-between gap-4 border-border border-b pb-5"
	>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Board</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Quem tá construindo o quê
			</p>
		</div>
		<Button href="/checkin">Postar check-in</Button>
	</div>
	{#if foundersQuery.isLoading}
		<Loader
			size="sm"
			subtitle="Buscando quem tá construindo"
			title="Carregando o board..."
		/>
	{:else if !founders.length}
		<p class="text-sm text-muted-foreground">Ninguém na matilha ainda.</p>
	{:else}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(440px,1fr))] gap-3">
			{#each founders as founder, index (founder.userId)}
				<FounderCard {founder} {index} />
			{/each}
		</div>
		<InfiniteScrollSentinel
			hasNextPage={foundersQuery.hasNextPage}
			isFetchingNextPage={foundersQuery.isFetchingNextPage}
			onLoadMore={() => foundersQuery.fetchNextPage()}
		/>
	{/if}
</div>
