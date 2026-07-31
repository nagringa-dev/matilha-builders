<script lang="ts">
	import CheckInItem from "./check-in-item.svelte";
	import InfiniteScrollSentinel from "./infinite-scroll-sentinel.svelte";

	interface Product {
		id: string;
		imageUrl: string | null;
		link: string | null;
		name: string;
		status: "validating" | "building" | "launched";
	}

	interface CheckIn {
		blocked: string;
		createdAt: string | Date;
		dismissedAt?: string | Date | null;
		founderId: string;
		help: string | null;
		id: string;
		product: Product | null;
		progress: string;
	}

	let {
		history,
		founderName,
		currentUserId = null,
		hasNextPage,
		isFetchingNextPage,
		onLoadMore,
	}: {
		history: CheckIn[];
		founderName: string;
		currentUserId?: string | null;
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		onLoadMore: () => void;
	} = $props();
</script>

<section>
	<p class="pb-3 font-mono text-[13px] text-muted-foreground">
		{history.length}
		{history.length === 1 ? "check-in" : "check-ins"}
		· olha quanto já andou
	</p>
	<div class="flex flex-col gap-3">
		{#if history.length}
			{#each history as checkIn, index (checkIn.id)}
				<CheckInItem
					checkIn={{ ...checkIn, name: founderName }}
					{currentUserId}
					{index}
					showAuthor={false}
				/>
			{/each}
			<InfiniteScrollSentinel {hasNextPage} {isFetchingNextPage} {onLoadMore} />
		{:else}
			<p class="text-sm text-muted-foreground">
				Nenhum check-in ainda. Começa essa semana.
			</p>
		{/if}
	</div>
</section>
