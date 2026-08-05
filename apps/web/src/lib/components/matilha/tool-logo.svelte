<script lang="ts">
	import { cn } from "$lib/utils.js";

	let {
		name,
		logoUrl,
		size = "md",
		class: className,
	}: {
		name: string;
		logoUrl?: string | null;
		size?: "lg" | "md" | "sm" | "xl";
		class?: string;
	} = $props();

	const sizeClasses = {
		lg: "size-11 rounded-lg text-lg",
		md: "size-9 rounded-lg text-sm",
		sm: "size-6 rounded-md text-[10px]",
		xl: "size-16 rounded-xl text-2xl",
	};

	let failedSrc = $state<string | null>(null);
	const showInitial = $derived(!logoUrl || failedSrc === logoUrl);
	const initial = $derived((name || "?").charAt(0).toUpperCase());

	function handleError() {
		failedSrc = logoUrl ?? null;
	}
</script>

{#if showInitial}
	<span
		class={cn(
			"flex shrink-0 items-center justify-center bg-muted font-semibold text-muted-foreground ring-1 ring-border",
			sizeClasses[size],
			className
		)}
	>
		{initial}
	</span>
{:else}
	<span
		class={cn(
			"flex shrink-0 items-center justify-center overflow-hidden bg-muted ring-1 ring-border",
			sizeClasses[size],
			className
		)}
	>
		<!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: onerror is a load-failure event, not a user interaction -->
		<img
			alt="Logo {name}"
			class="size-full object-cover"
			onerror={handleError}
			src={logoUrl as string}
		>
	</span>
{/if}
