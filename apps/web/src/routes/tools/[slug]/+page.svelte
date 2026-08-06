<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { toolCategoryLabel } from "@matilha-builders/db/tool-categories";
	import { createInfiniteQuery, createQuery } from "@tanstack/svelte-query";
	import { page } from "$app/state";
	import Avatar from "$lib/components/matilha/avatar.svelte";
	import AvatarStack from "$lib/components/matilha/avatar-stack.svelte";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import ProductChip from "$lib/components/matilha/product-chip.svelte";
	import StreakBadge from "$lib/components/matilha/streak-badge.svelte";
	import ToolAdoptDrawer from "$lib/components/matilha/tool-adopt-drawer.svelte";
	import ToolInfoDrawer from "$lib/components/matilha/tool-info-drawer.svelte";
	import ToolLogo from "$lib/components/matilha/tool-logo.svelte";
	import ToolUsageDrawer from "$lib/components/matilha/tool-usage-drawer.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { toast } from "$lib/components/ui/sonner/index.js";
	import { client, orpc } from "$lib/orpc";

	type Adopter = Awaited<
		ReturnType<typeof client.tools.listAdopters>
	>["items"][number];

	const slug = $derived(page.params.slug ?? "");

	const toolQuery = createQuery(() =>
		orpc.tools.get.queryOptions({ input: { slug } })
	);
	const tool = $derived(toolQuery.data);

	let showAdoptDrawer = $state(false);
	let showUsageDrawer = $state(false);
	let showInfoDrawer = $state(false);
	let showAll = $state(false);

	const displayHost = $derived(tool?.url.replace(/^https?:\/\//, "") ?? "");
	// The preview holds only noted adopters; everyone else is behind the list.
	const hasMore = $derived(
		!!tool && tool.adopterCount > tool.notedAdopters.length
	);

	const adoptersQuery = createInfiniteQuery(() => ({
		...orpc.tools.listAdopters.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor, slug }),
		}),
		enabled: showAll,
	}));
	const allAdopters = $derived(
		adoptersQuery.data?.pages.flatMap((adoptersPage) => adoptersPage.items) ??
			[]
	);

	function shareLink() {
		navigator.clipboard.writeText(window.location.href);
		toast.success("Link copiado.");
	}
</script>

{#snippet adopterRow(adopter: Adopter)}
	<div class="flex gap-3">
		<Avatar name={adopter.name} size="md" src={adopter.avatarUrl} />
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<a
					class="text-[15px] font-semibold"
					href="/profile/{adopter.founderId}"
				>
					{adopter.name}
				</a>
				<StreakBadge weeks={adopter.streak} />
			</div>
			{#if adopter.note}
				<p class="text-sm text-muted-foreground leading-relaxed">
					{adopter.note}
				</p>
			{/if}
			{#if adopter.products.length}
				<div class="mt-1 flex flex-wrap items-center gap-1.5">
					<span class="text-[11px] text-muted-foreground">usa em</span>
					{#each adopter.products as product (product.id)}
						<ProductChip {product} variant="tag" />
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="px-4 py-6 md:px-6">
	<a
		class="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"
		href="/tools"
	>
		<ChevronLeftIcon class="size-3.5" />
		Ferramentas
	</a>

	{#if toolQuery.isLoading}
		<Loader size="sm" subtitle="Buscando a ferramenta" title="Carregando..." />
	{:else if toolQuery.isError || !tool}
		<p class="text-sm text-muted-foreground">Ferramenta não encontrada.</p>
	{:else}
		<div class="flex gap-4">
			<ToolLogo logoUrl={tool.logoUrl} name={tool.name} size="xl" />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-xl font-semibold tracking-tight">{tool.name}</h1>
					<span
						class="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
					>
						{toolCategoryLabel(tool.category)}
					</span>
				</div>
				{#if tool.description}
					<p class="text-sm text-muted-foreground">{tool.description}</p>
				{/if}
				<div class="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
					<a
						class="font-semibold underline decoration-muted-foreground/40 underline-offset-2 hover:text-streak"
						href={tool.url}
						rel="noreferrer"
						target="_blank"
					>
						{displayHost}
					</a>
					<ExternalLinkIcon class="size-3.5 text-muted-foreground" />
					<span class="text-muted-foreground">
						usado por <strong>{tool.adopterCount}</strong>
						{tool.adopterCount === 1 ? "builder" : "builders"}
					</span>
				</div>
			</div>
		</div>

		<div class="mt-5 flex flex-wrap items-center gap-2">
			{#if tool.viewerAdoption}
				<Button
					onclick={() => {
						showUsageDrawer = true;
					}}
					variant="outline"
				>
					Editar meu uso
				</Button>
			{:else}
				<Button
					onclick={() => {
						showAdoptDrawer = true;
					}}
				>
					<PlusIcon class="size-3.5" />
					Eu uso também
				</Button>
			{/if}
			<Button onclick={shareLink} variant="outline">Compartilhar</Button>
			{#if tool.viewerAdoption}
				<Button
					onclick={() => {
						showInfoDrawer = true;
					}}
					size="sm"
					variant="ghost"
				>
					Editar informações
				</Button>
			{/if}
		</div>

		{#if tool.viewerAdoption}
			<ToolUsageDrawer
				adoption={tool.viewerAdoption}
				bind:open={showUsageDrawer}
			/>
			<ToolInfoDrawer {tool} bind:open={showInfoDrawer} />
		{:else}
			<ToolAdoptDrawer initialUrl={tool.url} bind:open={showAdoptDrawer} />
		{/if}

		<hr class="mt-6 border-border">

		<div class="mt-5">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-sm font-semibold">Quem usa na Matilha</h2>
				<span class="text-xs text-muted-foreground">
					{tool.adopterCount}
					{tool.adopterCount === 1 ? "builder" : "builders"}
				</span>
			</div>

			{#if tool.adopterCount === 0}
				<p class="mt-4 text-sm text-muted-foreground">
					Ninguém adicionou essa ferramenta ainda.
				</p>
			{:else}
				<div class="mt-4 flex flex-col gap-4">
					{#if showAll}
						{#each allAdopters as adopter (adopter.founderId)}
							{@render adopterRow(adopter)}
						{/each}
						<InfiniteScrollSentinel
							hasNextPage={adoptersQuery.hasNextPage}
							isFetchingNextPage={adoptersQuery.isFetchingNextPage}
							onLoadMore={() => adoptersQuery.fetchNextPage()}
						/>
					{:else}
						{#each tool.notedAdopters as adopter (adopter.founderId)}
							{@render adopterRow(adopter)}
						{/each}
					{/if}
				</div>

				{#if !showAll && tool.silentCount > 0}
					<hr class="mt-4 border-border">
					<div class="mt-4 flex items-center gap-2">
						<AvatarStack
							total={tool.silentCount}
							urls={tool.silentAvatarUrls}
						/>
						<span class="text-xs text-muted-foreground">também usam</span>
					</div>
				{/if}

				{#if !showAll && hasMore}
					<Button
						class="mt-4"
						onclick={() => {
							showAll = true;
						}}
						size="sm"
						variant="ghost"
					>
						Ver todos os {tool.adopterCount}
					</Button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
