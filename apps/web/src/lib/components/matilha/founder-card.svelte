<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import { formatRelative } from "$lib/format";
	import Avatar from "./avatar.svelte";
	import ProductChip from "./product-chip.svelte";
	import StreakBadge from "./streak-badge.svelte";

	interface Product {
		icp?: string | null;
		id: string;
		imageUrl: string | null;
		link: string | null;
		name: string;
		painPoint?: string | null;
		solution?: string | null;
		status: "validating" | "building" | "launched";
	}

	interface Founder {
		avatarUrl?: string | null;
		lastCheckInAt: string | Date | null;
		name: string;
		products: Product[];
		streak: number;
		userId: string;
	}

	let { founder, index = 0 }: { founder: Founder; index?: number } = $props();

	// Local-only reordering: clicking a secondary product swaps it into the
	// featured slot for this browsing session. Not persisted. Derived (not a
	// standalone $state snapshot) so it stays in sync with `founder.products`
	// whenever the board list refetches — Svelte reuses this same component
	// instance across refetches (keyed by userId), so a plain $state snapshot
	// taken at mount would otherwise never see later changes (new/edited
	// products, for example).
	let highlightedId = $state<string | null>(null);
	const localProducts = $derived.by(() => {
		if (!highlightedId) {
			return founder.products;
		}
		const highlightedIndex = founder.products.findIndex(
			(p) => p.id === highlightedId
		);
		if (highlightedIndex <= 0) {
			return founder.products;
		}
		return [
			founder.products[highlightedIndex] as Product,
			...founder.products.filter((_, i) => i !== highlightedIndex),
		];
	});

	function highlightProduct(e: MouseEvent, clicked: Product) {
		e.stopPropagation();
		highlightedId = clicked.id;
	}
</script>

<motion.div
	animate={{ opacity: 1, y: 0 }}
	class="relative flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out)] hover:[@media(hover:hover)and(pointer:fine)]:-translate-y-0.5 hover:[@media(hover:hover)and(pointer:fine)]:border-foreground/15 hover:[@media(hover:hover)and(pointer:fine)]:shadow-[0_8px_24px_-8px_rgb(0_0_0_/_0.4)]"
	initial={{ opacity: 0, y: 6 }}
	transition={{ delay: index * 0.04, duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
	whileTap={{ scale: 0.99 }}
>
	<a
		aria-label="Ver perfil de {founder.name}"
		class="absolute inset-0 z-0 rounded-xl"
		href="/profile/{founder.userId}"
	></a>
	<div class="pointer-events-none relative z-10 flex flex-1 flex-col">
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-center gap-2.5">
				<Avatar name={founder.name} src={founder.avatarUrl} />
				<div class="text-[15px] font-semibold">{founder.name}</div>
			</div>
			<StreakBadge weeks={founder.streak} />
		</div>
		<div class="mt-4 flex-1 border-border/60 border-t pt-3.5">
			{#if localProducts.length}
				{@const [primary, ...rest] = localProducts}
				<ProductChip product={primary} variant="cover" />
				{#if rest.length}
					<div class="mt-4 text-muted-foreground text-xs">Outros produtos</div>
					<div class="pointer-events-auto mt-1.5 flex flex-wrap gap-1.5">
						<AnimatePresence>
							{#each rest as p (p.id)}
								<motion.button
									animate={{ opacity: 1, scale: 1 }}
									class="group relative z-10 cursor-pointer rounded-full"
									exit={{ opacity: 0, scale: 0.9 }}
									initial={{ opacity: 0, scale: 0.9 }}
									key={p.id}
									onclick={(e: MouseEvent) => highlightProduct(e, p)}
									transition={{ duration: 0.16 }}
									type="button"
								>
									<ProductChip
										class="transition-colors group-hover:border-streak/50 group-hover:bg-streak/10"
										product={p}
										showImage={false}
										variant="tag"
									/>
								</motion.button>
							{/each}
						</AnimatePresence>
					</div>
				{/if}
			{:else}
				<span class="text-[13px] text-muted-foreground"
					>sem produtos ainda</span
				>
			{/if}
		</div>
		<div class="mt-3.5 flex items-center justify-end">
			<span class="text-xs text-muted-foreground">
				{founder.lastCheckInAt
					? `atualizado ${formatRelative(founder.lastCheckInAt)}`
					: "ainda sem check-in"}
			</span>
		</div>
	</div>
</motion.div>
