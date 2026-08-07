<script lang="ts">
	import { getProductFaviconUrl } from "$lib/product-favicon.js";
	import { cn } from "$lib/utils.js";

	type Status = "validating" | "building" | "launched";

	interface Product {
		link?: string | null;
		name: string;
		status: Status;
	}

	let {
		product,
		class: className,
	}: {
		product: Product;
		class?: string;
	} = $props();

	const statusLabels: Record<Status, string> = {
		building: "construindo",
		launched: "lançado",
		validating: "validando",
	};

	const statusDotClasses: Record<Status, string> = {
		building: "bg-status-building",
		launched: "bg-status-launched",
		validating: "bg-status-validating",
	};

	const initial = $derived((product.name || "?").charAt(0).toUpperCase());
	const faviconUrl = $derived(getProductFaviconUrl(product.link));
	let failedFaviconUrl = $state<string | null>(null);
	const showInitial = $derived(!faviconUrl || failedFaviconUrl === faviconUrl);

	function handleFaviconError() {
		failedFaviconUrl = faviconUrl;
	}
</script>

<span class={cn("flex min-w-0 flex-1 items-center gap-3 text-left", className)}>
	{#if showInitial}
		<span
			aria-hidden="true"
			class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground text-sm ring-1 ring-border"
		>
			{initial}
		</span>
	{:else}
		<!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: onerror only handles a failed favicon -->
		<img
			alt=""
			class="size-9 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-border"
			onerror={handleFaviconError}
			src={faviconUrl ?? undefined}
		>
	{/if}
	<span class="min-w-0 flex-1">
		<span class="block truncate font-semibold text-sm leading-tight">
			{product.name}
		</span>
		<span
			class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground leading-none"
		>
			<span
				aria-hidden="true"
				class={cn("size-1.5 shrink-0 rounded-full", statusDotClasses[product.status])}
			></span>
			{statusLabels[product.status]}
		</span>
	</span>
</span>
