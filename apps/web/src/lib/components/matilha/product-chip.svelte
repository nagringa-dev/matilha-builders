<script lang="ts">
	import { motion } from "@humanspeak/svelte-motion";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import {
		Drawer,
		DrawerClose,
		DrawerContent,
		DrawerDescription,
		DrawerFooter,
		DrawerHeader,
		DrawerTitle,
		DrawerTrigger,
	} from "$lib/components/ui/drawer/index.js";
	import {
		Tooltip,
		TooltipContent,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip/index.js";
	import { getProductFaviconUrl } from "$lib/product-favicon.js";
	import { cn } from "$lib/utils.js";

	type Status = "validating" | "building" | "launched";

	interface Product {
		icp?: string | null;
		id: string;
		imageUrl?: string | null;
		link?: string | null;
		name: string;
		painPoint?: string | null;
		solution?: string | null;
		status?: Status;
	}

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

	const sizeDims: Record<"sm" | "md" | "lg", string> = {
		lg: "size-16",
		md: "size-12",
		sm: "size-8",
	};
	const dims = $derived(variant === "tag" ? "size-6" : sizeDims[size]);
	const radius = $derived(variant === "tag" ? "rounded-md" : "rounded-xl");
	const sizeInitialText: Record<"sm" | "md" | "lg", string> = {
		lg: "text-xl",
		md: "text-base",
		sm: "text-sm",
	};
	const initialSize = $derived(
		variant === "tag" ? "text-xs" : sizeInitialText[size]
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
	const faviconUrl = $derived(getProductFaviconUrl(product.link));

	// Product cover images and compact favicons can both fail independently.
	// Tracking the failed URL (rather than a boolean) makes a later URL retry.
	let failedImageUrl = $state<string | null>(null);
	const showCoverInitial = $derived(
		!product.imageUrl || failedImageUrl === product.imageUrl
	);

	function handleImageError() {
		failedImageUrl = product.imageUrl ?? null;
	}

	let failedFaviconUrl = $state<string | null>(null);
	const showFaviconInitial = $derived(
		!faviconUrl || failedFaviconUrl === faviconUrl
	);

	function handleFaviconError() {
		failedFaviconUrl = faviconUrl;
	}

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
	{#if showFaviconInitial}
		<span
			aria-hidden="true"
			class={cn(
				"flex shrink-0 items-center justify-center bg-muted font-semibold text-muted-foreground",
				variant === "tag" ? "" : "ring-1 ring-border",
				dims,
				radius,
				initialSize
			)}
		>
			{initial}
		</span>
	{:else}
		<!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: onerror only handles a failed favicon -->
		<img
			alt=""
			class={cn(
				"shrink-0 object-cover",
				variant === "tag" ? "" : "ring-1 ring-border",
				dims,
				radius
			)}
			onerror={handleFaviconError}
			src={faviconUrl ?? undefined}
		>
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
	<Drawer>
		<DrawerTrigger
			class="pointer-events-auto relative self-start text-muted-foreground text-xs underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground"
			onclick={(e: MouseEvent) => e.stopPropagation()}
		>
			Ver mais sobre
		</DrawerTrigger>
		<DrawerContent class="mx-auto max-w-fit">
			<div
				class="themed-scrollbar mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto"
			>
				<DrawerHeader>
					<DrawerTitle class="text-lg">{product.name}</DrawerTitle>
					<DrawerDescription>
						{#if product.status}
							{statusLabels[product.status]}
						{/if}
					</DrawerDescription>
				</DrawerHeader>
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
				<DrawerFooter>
					<DrawerClose
						class="h-9 w-full rounded-md border border-border text-sm transition-colors hover:bg-accent"
					>
						Fechar
					</DrawerClose>
				</DrawerFooter>
			</div>
		</DrawerContent>
	</Drawer>
{/snippet}

{#if variant === "tag"}
	<Tooltip>
		<TooltipTrigger>
			{#snippet child({ props })}
				<span
					{...props}
					class={cn(
						"inline-flex min-w-0 items-center gap-1.5 text-left text-xs font-medium",
						className
					)}
				>
					{#if showImage}
						{@render thumb()}
					{/if}
					{#if product.link}
						<a
							class="min-w-0 truncate underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-streak hover:decoration-streak"
							href={product.link}
							onclick={(e) => e.stopPropagation()}
							rel="noreferrer"
							target="_blank"
						>
							{product.name}
						</a>
					{:else}
						<span class="truncate">{product.name}</span>
					{/if}
					{#if product.status && showStatus}
						<span
							class="flex shrink-0 items-center gap-1 text-muted-foreground"
						>
							<span
								class={cn("size-1.5 rounded-full", dotStyles[product.status])}
							></span>
							{statusLabels[product.status]}
						</span>
					{/if}
				</span>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>{product.name}</TooltipContent>
	</Tooltip>
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
			{#if showCoverInitial}
				<div
					class="flex h-full w-full items-center justify-center font-bold text-3xl text-muted-foreground"
				>
					{initial}
				</div>
			{:else}
				<!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: onerror is a load-failure event, not a user interaction -->
				<img
					alt="Imagem do produto {product.name}"
					class="h-full w-full object-cover"
					onerror={handleImageError}
					src={product.imageUrl}
				>
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
