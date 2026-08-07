<script lang="ts">
	import { AnimatePresence } from "@humanspeak/svelte-motion";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { Button } from "$lib/components/ui/button/index.js";
	import { optimisticCache } from "$lib/optimistic-list";
	import { client, orpc } from "$lib/orpc";
	import { invalidateToolCaches } from "$lib/tool-cache";
	import ToolAdoptDrawer from "./tool-adopt-drawer.svelte";
	import ToolCard from "./tool-card.svelte";

	let {
		founderId,
		isOwnProfile,
	}: { founderId: string; isOwnProfile: boolean } = $props();

	const toolsQuery = createQuery(() =>
		orpc.tools.byFounder.queryOptions({ input: { founderId } })
	);
	type ToolsData = Awaited<ReturnType<typeof client.tools.byFounder>>;

	const queryClient = useQueryClient();
	let showDrawer = $state(false);

	const toolsCache = optimisticCache<ToolsData>(
		queryClient,
		() => orpc.tools.byFounder.queryOptions({ input: { founderId } }).queryKey
	);

	const removeFromStack = createMutation(() => ({
		...orpc.tools.removeFromStack.mutationOptions(),
		onError: (
			_error,
			_input,
			context: { snapshot: ToolsData | undefined } | undefined
		) => {
			toolsCache.restore(context?.snapshot);
		},
		onMutate: async (input) => {
			const snapshot = await toolsCache.snapshotAndCancel();
			toolsCache.patch((data) =>
				data.filter((tool) => tool.toolId !== input.toolId)
			);
			return { snapshot };
		},
		onSettled: () => invalidateToolCaches(queryClient),
	}));

	function removeTool(toolId: string) {
		removeFromStack.mutate({ toolId });
	}

	function openDrawer() {
		showDrawer = true;
	}
</script>

{#snippet addTile()}
	<button
		class="flex min-h-[118px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-streak/45 hover:text-foreground"
		onclick={openDrawer}
		type="button"
	>
		<PlusIcon class="size-4" />
		Adicionar ferramenta
	</button>
{/snippet}

{#if toolsQuery.data}
	{@const tools = toolsQuery.data}
	<section>
		{#if isOwnProfile}
			<div class="flex items-center justify-between gap-3 pb-3">
				<span class="text-xs text-muted-foreground">
					{tools.length}
					{tools.length === 1 ? "ferramenta" : "ferramentas"}
				</span>
				<Button onclick={openDrawer} size="sm">
					<PlusIcon class="size-3.5" />
					Adicionar
				</Button>
			</div>
		{/if}
		{#if tools.length}
			<div
				class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 xl:grid-cols-2"
			>
				<AnimatePresence>
					{#each tools as tool (tool.toolId)}
						<ToolCard {isOwnProfile} onRemove={removeTool} {tool} />
					{/each}
				</AnimatePresence>
				{#if isOwnProfile}
					{@render addTile()}
				{/if}
			</div>
		{:else if isOwnProfile}
			{@render addTile()}
		{:else}
			<p class="text-sm text-muted-foreground">Nenhuma ferramenta ainda.</p>
		{/if}
	</section>
{/if}

<ToolAdoptDrawer bind:open={showDrawer} />
