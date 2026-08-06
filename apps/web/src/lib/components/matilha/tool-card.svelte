<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import { toolCategoryLabel } from "@matilha-builders/db/tool-categories";
	import { client } from "$lib/orpc";
	import ProductChip from "./product-chip.svelte";
	import ToolLogo from "./tool-logo.svelte";

	type Tool = Awaited<ReturnType<typeof client.tools.byFounder>>[number];

	let {
		isOwnProfile,
		onRemove,
		tool,
	}: {
		isOwnProfile: boolean;
		onRemove?: (toolId: string) => void;
		tool: Tool;
	} = $props();

	const categoryLabel = $derived(toolCategoryLabel(tool.category));
	const hasNote = $derived(!!tool.note && tool.note.trim().length > 0);

	function handleRemove(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onRemove?.(tool.toolId);
	}
</script>

<a
	class="group relative flex flex-col gap-2.5 rounded-lg border border-border bg-card/60 p-3.5 transition-colors hover:border-streak/45"
	href="/tools/{tool.slug}"
>
	<div class="flex items-center gap-2.5">
		<ToolLogo logoUrl={tool.logoUrl} name={tool.name} size="md" />
		<div class="min-w-0">
			<span class="block text-sm font-semibold">{tool.name}</span>
			<span class="block text-[11px] text-muted-foreground"
				>{categoryLabel}</span
			>
		</div>
	</div>
	{#if hasNote}
		<p class="text-xs leading-relaxed text-muted-foreground">{tool.note}</p>
	{/if}
	{#if tool.products.length}
		<div class="flex flex-wrap gap-1.5">
			{#each tool.products as product (product.id)}
				<ProductChip {product} variant="tag" />
			{/each}
		</div>
	{/if}
	{#if isOwnProfile}
		<button
			aria-label="Remover da stack"
			class="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
			onclick={handleRemove}
			type="button"
		>
			<XIcon class="size-3.5" />
		</button>
	{/if}
</a>
