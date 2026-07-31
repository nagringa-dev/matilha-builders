<script lang="ts">
	import { motion } from "@humanspeak/svelte-motion";
	import PackagePlusIcon from "@lucide/svelte/icons/package-plus";
	import { formatRelative } from "$lib/format";
	import CheckInItem from "./check-in-item.svelte";
	import InfiniteScrollSentinel from "./infinite-scroll-sentinel.svelte";
	import ProductChip from "./product-chip.svelte";
	import type { ProfileProduct } from "./profile-product.types.js";

	interface CheckInProduct {
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
		product: CheckInProduct | null;
		progress: string;
	}

	let {
		history,
		products,
		founderName,
		hasNextPage,
		isFetchingNextPage,
		onLoadMore,
	}: {
		history: CheckIn[];
		products: ProfileProduct[];
		founderName: string;
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		onLoadMore: () => void;
	} = $props();

	type TimelineEntry =
		| { kind: "check-in"; id: string; at: number; checkIn: CheckIn }
		| { kind: "product"; id: string; at: number; product: ProfileProduct };

	function toTime(date: string | Date) {
		return (typeof date === "string" ? new Date(date) : date).getTime();
	}

	/**
	 * Check-ins arrive paginated while products come whole, so a product older
	 * than the oldest loaded check-in would jump ahead of check-ins that haven't
	 * loaded yet. Hold those back until there's nothing left to page in.
	 */
	const oldestLoadedCheckIn = $derived(
		history.length
			? Math.min(...history.map((checkIn) => toTime(checkIn.createdAt)))
			: Number.POSITIVE_INFINITY
	);

	const entries = $derived(
		[
			...history.map(
				(checkIn): TimelineEntry => ({
					at: toTime(checkIn.createdAt),
					checkIn,
					id: `check-in-${checkIn.id}`,
					kind: "check-in",
				})
			),
			...products
				.filter(
					(product) =>
						!hasNextPage || toTime(product.createdAt) >= oldestLoadedCheckIn
				)
				.map(
					(product): TimelineEntry => ({
						at: toTime(product.createdAt),
						id: `product-${product.id}`,
						kind: "product",
						product,
					})
				),
		].sort((a, b) => b.at - a.at)
	);
</script>

<section class="flex flex-col gap-3">
	{#if entries.length}
		{#each entries as entry, index (entry.id)}
			{#if entry.kind === "check-in"}
				<CheckInItem
					checkIn={{ ...entry.checkIn, name: founderName }}
					{index}
					showAuthor={false}
				/>
			{:else}
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					class="rounded-xl border border-border bg-card p-4"
					initial={{ opacity: 0, y: 6 }}
					transition={{
						delay: index * 0.04,
						duration: 0.2,
						ease: [0.23, 1, 0.32, 1],
					}}
				>
					<div class="mb-3 flex items-center justify-between gap-3">
						<span
							class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
						>
							<PackagePlusIcon class="size-3.5" />
							Novo produto
						</span>
						<span class="font-mono text-xs text-muted-foreground"
							>{formatRelative(entry.product.createdAt)}</span
						>
					</div>
					<ProductChip product={entry.product} size="sm" variant="tile" />
				</motion.div>
			{/if}
		{/each}
		<InfiniteScrollSentinel {hasNextPage} {isFetchingNextPage} {onLoadMore} />
	{:else}
		<p class="text-sm text-muted-foreground">
			Nada por aqui ainda. Cadastra um produto ou faz teu primeiro check-in.
		</p>
	{/if}
</section>
