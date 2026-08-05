<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import {
		TOOL_CATEGORIES,
		toolCategoryLabel,
	} from "@matilha-builders/db/tool-categories";
	import {
		createInfiniteQuery,
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { page } from "$app/state";
	import Avatar from "$lib/components/matilha/avatar.svelte";
	import Field from "$lib/components/matilha/field.svelte";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import ProductChip from "$lib/components/matilha/product-chip.svelte";
	import ProductStatus from "$lib/components/matilha/product-status.svelte";
	import StreakBadge from "$lib/components/matilha/streak-badge.svelte";
	import ToolDrawer from "$lib/components/matilha/tool-drawer.svelte";
	import ToolLogo from "$lib/components/matilha/tool-logo.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Drawer,
		DrawerContent,
		DrawerHeader,
		DrawerTitle,
	} from "$lib/components/ui/drawer/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import { toast } from "$lib/components/ui/sonner/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { orpc } from "$lib/orpc";

	const slug = $derived(page.params.slug ?? "");
	const queryClient = useQueryClient();

	const toolQuery = createQuery(() =>
		orpc.tools.get.queryOptions({ input: { slug } })
	);
	const tool = $derived(toolQuery.data);

	interface Adopter {
		avatarUrl: string | null;
		founderId: string;
		name: string;
		note: string | null;
		products: {
			icp: string | null;
			id: string;
			imageUrl: string | null;
			link: string | null;
			name: string;
			painPoint: string | null;
			solution: string | null;
			status: "building" | "launched" | "validating";
		}[];
		streak: number;
	}

	let showDrawer = $state(false);
	let showEditInfo = $state(false);
	let showAll = $state(false);

	const categoryLabel = $derived(tool ? toolCategoryLabel(tool.category) : "");
	const displayHost = $derived(tool?.url.replace(/^https?:\/\//, "") ?? "");

	const canShowMore = $derived(tool?.hasMoreAdopters ?? false);

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

	function openDrawer() {
		showDrawer = true;
	}

	function openEditInfo() {
		showEditInfo = true;
	}

	function revealAll() {
		showAll = true;
	}

	function selectEditCategory(value: string) {
		editCategory = value;
	}

	let editName = $state("");
	let editCategory = $state("");
	let editDescription = $state("");

	const editCategoryLabel = $derived(
		editCategory ? toolCategoryLabel(editCategory) : "Selecione"
	);

	$effect(() => {
		if (showEditInfo && tool) {
			editName = tool.name;
			editCategory = tool.category;
			editDescription = tool.description ?? "";
		}
	});

	const updateTool = createMutation(() => ({
		...orpc.tools.updateTool.mutationOptions(),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: orpc.tools.get.key() });
		},
		onSuccess: () => {
			showEditInfo = false;
		},
	}));

	function submitEditInfo() {
		if (!tool) {
			return;
		}
		updateTool.mutate({
			category: editCategory as (typeof TOOL_CATEGORIES)[number]["slug"],
			description: editDescription.trim() || undefined,
			name: editName.trim(),
			toolId: tool.id,
		});
	}
</script>

{#snippet adopterRow(a: Adopter)}
	<div class="flex gap-3">
		<Avatar name={a.name} size="md" src={a.avatarUrl} />
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<a class="text-[15px] font-semibold" href="/profile/{a.founderId}">
					{a.name}
				</a>
				<StreakBadge weeks={a.streak} />
			</div>
			{#if a.note?.trim()}
				<p class="text-sm text-muted-foreground leading-relaxed">{a.note}</p>
			{/if}
			{#if a.products.length}
				<div class="mt-1 flex flex-wrap items-center gap-1.5">
					<span class="text-[11px] text-muted-foreground">usa em</span>
					{#each a.products as p (p.id)}
						<ProductChip product={p} showImage={false} variant="tag">
							{#snippet trailing()}
								{#if p.status}
									<ProductStatus status={p.status} />
								{/if}
							{/snippet}
						</ProductChip>
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
						{categoryLabel}
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
				<Button onclick={openDrawer} variant="outline"> Editar meu uso </Button>
			{:else}
				<Button onclick={openDrawer}>
					<PlusIcon class="size-3.5" />
					Eu uso também
				</Button>
			{/if}
			<Button onclick={shareLink} variant="outline">Compartilhar</Button>
			{#if tool.viewerAdoption}
				<Button onclick={openEditInfo} size="sm" variant="ghost">
					Editar informações
				</Button>
			{/if}
		</div>

		<ToolDrawer
			adoption={tool.viewerAdoption}
			initialUrl={tool.url}
			bind:open={showDrawer}
		/>

		{#if tool.viewerAdoption}
			<Drawer bind:open={showEditInfo}>
				<DrawerContent>
					<div
						class="themed-scrollbar mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto"
					>
						<DrawerHeader>
							<DrawerTitle>Editar informações</DrawerTitle>
						</DrawerHeader>
						<div class="flex flex-col gap-4 px-4 pb-4">
							<Field htmlFor="edit-tool-name" label="Nome">
								<Input id="edit-tool-name" bind:value={editName} />
							</Field>
							<Field label="Categoria">
								<Select
									onValueChange={selectEditCategory}
									type="single"
									value={editCategory}
								>
									<SelectTrigger class="w-full">
										{editCategoryLabel}
									</SelectTrigger>
									<SelectContent>
										{#each TOOL_CATEGORIES as entry (entry.slug)}
											<SelectItem label={entry.label} value={entry.slug}>
												{entry.label}
											</SelectItem>
										{/each}
									</SelectContent>
								</Select>
							</Field>
							<Field
								hint="opcional"
								htmlFor="edit-tool-description"
								label="Descrição"
							>
								<Textarea
									id="edit-tool-description"
									rows={3}
									bind:value={editDescription}
								/>
							</Field>
							<Button
								disabled={!(editName.trim() && editCategory) || updateTool.isPending}
								onclick={submitEditInfo}
								type="button"
							>
								{updateTool.isPending ? "Salvando..." : "Salvar"}
							</Button>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
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
						{#each allAdopters as a (a.founderId)}
							{@render adopterRow(a)}
						{/each}
						<InfiniteScrollSentinel
							hasNextPage={adoptersQuery.hasNextPage}
							isFetchingNextPage={adoptersQuery.isFetchingNextPage}
							onLoadMore={() => adoptersQuery.fetchNextPage()}
						/>
					{:else}
						{#each tool.notedAdopters as a (a.founderId)}
							{@render adopterRow(a)}
						{/each}
					{/if}
				</div>

				{#if !showAll && tool.notedCount > 0 && tool.silentCount > 0}
					<hr class="mt-4 border-border">
					<div class="mt-4 flex items-center gap-2">
						<span class="flex">
							{#each tool.silentAvatarUrls as avatarUrl, index (avatarUrl)}
								<Avatar
									class={index === 0
											? "ring-2 ring-background"
											: "-ml-1.5 ring-2 ring-background"}
									name=""
									size="sm"
									src={avatarUrl}
								/>
							{/each}
							{#if tool.silentCount > tool.silentAvatarUrls.length}
								<span
									class="-ml-1.5 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background"
								>
									+{tool.silentCount - tool.silentAvatarUrls.length}
								</span>
							{/if}
						</span>
						<span class="text-xs text-muted-foreground">também usam</span>
					</div>
				{/if}

				{#if !showAll && canShowMore}
					<Button class="mt-4" onclick={revealAll} size="sm" variant="ghost">
						Ver todos os {tool.adopterCount}
					</Button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
