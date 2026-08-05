<script lang="ts">
	import { cn } from "$lib/utils.js";

	let {
		src,
		name,
		size = "md",
		class: className,
	}: {
		src?: string | null;
		name: string;
		size?: "sm" | "md" | "lg";
		class?: string;
	} = $props();

	const sizeClasses = {
		lg: "size-16 text-xl",
		md: "size-7 text-xs",
		sm: "size-5 text-[10px]",
	};

	const initial = $derived((name || "?").charAt(0).toUpperCase());
</script>

{#if src}
	<img
		alt={name}
		class={cn("rounded-full object-cover", sizeClasses[size], className)}
		{src}
	>
{:else}
	<span
		class={cn(
			"flex items-center justify-center rounded-full bg-muted font-semibold text-foreground ring-1 ring-border/70 shadow-inner",
			sizeClasses[size],
			className
		)}
	>
		{initial}
	</span>
{/if}
