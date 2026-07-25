<script lang="ts">
	import { motion } from "@humanspeak/svelte-motion";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import * as Drawer from "$lib/components/ui/drawer/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn } from "$lib/utils.js";

	type Status = "validating" | "building" | "launched";

	type Product = {
		id: string;
		name: string;
		link?: string | null;
		imageUrl?: string | null;
		status?: Status;
		icp?: string | null;
		painPoint?: string | null;
		solution?: string | null;
	};

	let {
		product,
		variant = "cover",
		size = "md",
		showStatus = true,
		showImage = true,
		class: className,
	}: {
		product: Product;
		variant?: "cover" | "tile" | "tag";
		size?: "sm" | "md" | "lg";
		showStatus?: boolean;
		showImage?: boolean;
		class?: string;
	} = $props();

	const dims = $derived(
		variant === "tag"
			? "size-6"
			: size === "lg"
				? "size-16"
				: size === "sm"
					? "size-8"
					: "size-12"
	);
	const radius = $derived(variant === "tag" ? "rounded-md" : "rounded-xl");
	const initialSize = $derived(
		variant === "tag"
			? "text-xs"
			: size === "lg"
				? "text-xl"
				: size === "sm"
					? "text-sm"
					: "text-base"
	);
	const captionTextClass = $derived(size === "sm" ? "text-sm" : "text-[15px]");
	const coverHeight = $derived(
		size === "lg" ? "h-56 xl:h-[254px]" : "h-50 xl:h-[230px]"
	);

	const statusLabels: Record<Status, string> = {
		building: "construindo",
		launched: "lançado",
		validating: "validando",
	};

	const dotStyles: Record<Status, string> = {
		building: "bg-status-building",
		launched: "bg-status-launched",
		validating: "bg-status-validating",
	};

	const initial = $derived((product.name || "?").charAt(0).toUpperCase());

	const tagDisplayName = $derived(
		product.name.length > 10 ? `${product.name.slice(0, 10)}…` : product.name
	);

	const detailSections = $derived(
		[
			{ label: "ICP", value: product.icp },
			{ label: "Dor a ser resolvida", value: product.painPoint },
			{ label: "Solução", value: product.solution },
		].filter(
			(section): section is { label: string; value: string } => !!section.value
		)
	);
	const hasDetails = $derived(detailSections.length > 0);
</script>

{#snippet thumb()}
	{#if product.imageUrl}
		<img
			alt="Imagem do produto {product.name}"
			class={cn("shrink-0 object-cover ring-1 ring-border", dims, radius)}
			src={product.imageUrl}
		>
	{:else}
		<span
			class={cn(
				"flex shrink-0 items-center justify-center bg-muted font-semibold text-muted-foreground ring-1 ring-border",
				dims,
				radius,
				initialSize
			)}
		>
			{initial}
		</span>
	{/if}
{/snippet}

{#snippet caption()}
	<div class="flex items-center justify-between gap-2">
		{#if product.link}
			<a
				class={cn(
					"pointer-events-auto relative flex min-w-0 items-center gap-1 truncate font-semibold text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-streak hover:decoration-streak",
					captionTextClass
				)}
				href={product.link}
				onclick={(e) => e.stopPropagation()}
				rel="noreferrer"
				target="_blank"
			>
				<span class="truncate">{product.name}</span>
				<ExternalLinkIcon class="size-3.5 shrink-0" />
			</a>
		{:else}
			<span class={cn("truncate font-semibold", captionTextClass)}
				>{product.name}</span
			>
		{/if}
		{#if product.status && showStatus}
			<span
				class="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs"
			>
				<span
					class={cn("size-1.5 rounded-full", dotStyles[product.status])}
				></span>
				{statusLabels[product.status]}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet detailsDrawer()}
	<Drawer.Root>
		<Drawer.Trigger
			class="pointer-events-auto relative self-start text-muted-foreground text-xs underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
			onclick={(e: MouseEvent) => e.stopPropagation()}
		>
			Ver mais sobre
		</Drawer.Trigger>
		<Drawer.Content class="mx-auto max-w-fit">
			<div class="mx-auto w-full max-w-md">
				<Drawer.Header>
					<Drawer.Title class="text-lg">{product.name}</Drawer.Title>
					<Drawer.Description>
						{#if product.status}
							{statusLabels[product.status]}
						{/if}
					</Drawer.Description>
				</Drawer.Header>
				<div class="flex flex-col gap-4 px-4 pb-6">
					{#each detailSections as section, index (section.label)}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							initial={{ opacity: 0, y: 8 }}
							transition={{
								delay: 0.06 * index,
								duration: 0.3,
								ease: [0.23, 1, 0.32, 1],
							}}
						>
							<div class="font-semibold text-muted-foreground text-xs">
								{section.label}
							</div>
							<p class="mt-1 text-sm leading-relaxed">{section.value}</p>
						</motion.div>
					{/each}
				</div>
				<Drawer.Footer>
					<Drawer.Close
						class="h-9 w-full rounded-md border border-border text-sm transition-colors hover:bg-accent"
					>
						Fechar
					</Drawer.Close>
				</Drawer.Footer>
			</div>
		</Drawer.Content>
	</Drawer.Root>
{/snippet}

{#if variant === "tag"}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span
					{...props}
					class={cn(
						"inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/60 py-0.5 pr-2.5 text-left text-xs font-medium",
						showImage ? "pl-0.5" : "pl-2.5",
						className
					)}
				>
					{#if showImage}
						{@render thumb()}
					{/if}
					{#if product.link}
						<a
							class="flex items-center gap-0.5 underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-streak hover:decoration-streak"
							href={product.link}
							onclick={(e) => e.stopPropagation()}
							rel="noreferrer"
							target="_blank"
						>
							<span>{tagDisplayName}</span>
							<ExternalLinkIcon class="size-3 shrink-0" />
						</a>
					{:else}
						<span>{tagDisplayName}</span>
					{/if}
					{#if product.status}
						<span class="flex shrink-0 items-center gap-1 text-muted-foreground">
							<span
								class={cn("size-1.5 rounded-full", dotStyles[product.status])}
							></span>
							{statusLabels[product.status]}
						</span>
					{/if}
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{product.name}</Tooltip.Content>
	</Tooltip.Root>
{:else if variant === "tile"}
	<div class={cn("flex items-center gap-3", className)}>
		{#if showImage}
			{@render thumb()}
		{/if}
		<div class="min-w-0 flex-1">
			{@render caption()}
		</div>
	</div>
{:else}
	<div class={cn("flex flex-col gap-2", className)}>
		<div
			class={cn("w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border", coverHeight)}
		>
			{#if product.imageUrl}
				<img
					alt="Imagem do produto {product.name}"
					class="h-full w-full object-cover"
					src={product.imageUrl}
				>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center font-bold text-3xl text-muted-foreground"
				>
					{initial}
				</div>
			{/if}
		</div>
		{@render caption()}
		<div class="min-h-5">
			{#if hasDetails}
				{@render detailsDrawer()}
			{/if}
		</div>
	</div>
{/if}
