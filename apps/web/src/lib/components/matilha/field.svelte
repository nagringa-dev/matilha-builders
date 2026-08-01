<script lang="ts">
	import type { Snippet } from "svelte";
	import { Label } from "$lib/components/ui/label/index.js";

	let {
		label,
		hint,
		error: errorMessage,
		htmlFor,
		children,
	}: {
		label?: string;
		hint?: string;
		error?: string;
		htmlFor?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-1.5">
	{#if label}
		<Label for={htmlFor}>{label}</Label>
	{/if}
	{@render children()}
	{#if errorMessage}
		<p class="text-sm text-destructive" id="{htmlFor}-error" role="alert">
			{errorMessage}
		</p>
	{:else if hint}
		<p class="text-xs text-muted-foreground" id="{htmlFor}-hint">{hint}</p>
	{/if}
</div>
