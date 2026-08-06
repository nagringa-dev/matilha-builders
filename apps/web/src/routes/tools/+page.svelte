<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import {
		TOOL_CATEGORIES,
		type ToolCategorySlug,
		toolCategoryLabel,
	} from "@matilha-builders/db/tool-categories";
	import { createInfiniteQuery } from "@tanstack/svelte-query";
	import AvatarStack from "$lib/components/matilha/avatar-stack.svelte";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import ToolAdoptDrawer from "$lib/components/matilha/tool-adopt-drawer.svelte";
	import ToolLogo from "$lib/components/matilha/tool-logo.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { orpc } from "$lib/orpc";
	import { cn } from "$lib/utils.js";

	let showDrawer = $state(false);
	let activeCategory = $state<ToolCategorySlug | undefined>(undefined);

	const toolsQuery = createInfiniteQuery(() =>
		orpc.tools.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ category: activeCategory, cursor }),
		})
	);

	const tools = $derived(
		toolsQuery.data?.pages.flatMap((page) => page.items) ?? []
	);

	const categoryLabel = toolCategoryLabel;

	const CATEGORY_PREVIEW_COUNT = 6;
	let showAllCategories = $state(false);

	const visibleCategories = $derived(
		showAllCategories
			? TOOL_CATEGORIES
			: TOOL_CATEGORIES.filter(
					(entry, index) =>
						index < CATEGORY_PREVIEW_COUNT || entry.slug === activeCategory
				)
	);
	const hiddenCount = $derived(
		TOOL_CATEGORIES.length - visibleCategories.length
	);

	function chipClass(active: boolean) {
		return cn(
			"inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
			active
				? "border-transparent bg-primary text-primary-foreground"
				: "border-border bg-background text-muted-foreground hover:text-foreground"
		);
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-8 md:px-6">
	<div
		class="mb-6 flex items-end justify-between gap-3 border-border border-b pb-5"
	>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Ferramentas</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				A stack que a comunidade realmente usa pra construir.
			</p>
		</div>
		<Button
			onclick={() => {
				showDrawer = true;
			}}
		>
			<PlusIcon class="size-3.5" />
			Adicionar
		</Button>
	</div>

	<ToolAdoptDrawer bind:open={showDrawer} />

	<div class="mb-5 flex flex-wrap gap-1.5">
		<button
			class={chipClass(activeCategory === undefined)}
			onclick={() => {
				activeCategory = undefined;
			}}
			type="button"
		>
			Todas
		</button>
		{#each visibleCategories as entry (entry.slug)}
			<button
				class={chipClass(activeCategory === entry.slug)}
				onclick={() => {
					activeCategory = entry.slug;
				}}
				type="button"
			>
				{entry.label}
			</button>
		{/each}
		{#if hiddenCount > 0 || showAllCategories}
			<button
				class={chipClass(false)}
				onclick={() => {
					showAllCategories = !showAllCategories;
				}}
				type="button"
			>
				{showAllCategories ? "menos" : `+${hiddenCount}`}
			</button>
		{/if}
	</div>

	{#if toolsQuery.isLoading}
		<Loader
			size="sm"
			subtitle="Buscando a stack da matilha"
			title="Carregando..."
		/>
	{:else if !tools.length}
		<p class="text-sm text-muted-foreground">
			{#if activeCategory === undefined}
				Ninguém adicionou ferramentas ainda — seja o primeiro.
			{:else}
				Nenhuma ferramenta nessa categoria ainda.
			{/if}
		</p>
	{:else}
		<div class="flex flex-col gap-1">
			{#each tools as item, index (item.id)}
				<a
					class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
					href="/tools/{item.slug}"
				>
					<span
						class="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground"
					>
						{index + 1}
					</span>
					<ToolLogo logoUrl={item.logoUrl} name={item.name} size="lg" />
					<div class="min-w-0 flex-1">
						<span class="block text-[15px] font-semibold">{item.name}</span>
						<span class="block text-xs text-muted-foreground">
							{categoryLabel(item.category)}
						</span>
					</div>
					<AvatarStack class="shrink-0 pr-1.5" urls={item.avatarUrls} />
					<span class="w-24 shrink-0 text-right text-xs text-muted-foreground">
						usado por
						<strong class="font-bold text-foreground"
							>{item.adopterCount}</strong
						>
					</span>
				</a>
			{/each}
		</div>
		<InfiniteScrollSentinel
			hasNextPage={toolsQuery.hasNextPage}
			isFetchingNextPage={toolsQuery.isFetchingNextPage}
			onLoadMore={() => toolsQuery.fetchNextPage()}
		/>
	{/if}
</div>
