<script lang="ts">
	import { cn } from "$lib/utils.js";
	import Avatar from "./avatar.svelte";

	let {
		urls,
		total,
		class: className,
	}: {
		urls: string[];
		total?: number;
		class?: string;
	} = $props();

	const overflow = $derived(Math.max((total ?? urls.length) - urls.length, 0));
</script>

<span class={cn("flex", className)}>
	{#each urls as url, index (url)}
		<Avatar
			class={cn("ring-2 ring-background", index > 0 && "-ml-1.5")}
			name=""
			size="sm"
			src={url}
		/>
	{/each}
	{#if overflow > 0}
		<span
			class="-ml-1.5 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background"
		>
			+{overflow}
		</span>
	{/if}
</span>
