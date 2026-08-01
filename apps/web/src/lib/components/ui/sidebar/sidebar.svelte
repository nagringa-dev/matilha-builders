<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle,
	} from "$lib/components/ui/sheet/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { SIDEBAR_WIDTH_MOBILE } from "./constants.js";
	import { useSidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		side = "left",
		variant = "sidebar",
		collapsible = "offcanvas",
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		side?: "left" | "right";
		variant?: "sidebar" | "floating" | "inset";
		collapsible?: "offcanvas" | "icon" | "none";
	} = $props();

	const sidebar = useSidebar();
</script>

{#if collapsible === "none"}
	<div
		class={cn(
			"bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
{:else if sidebar.isMobile}
	<Sheet
		bind:open={() => sidebar.openMobile, (v) => sidebar.setOpenMobile(v)}
		{...restProps}
	>
		<SheetContent
			class={cn(
				"bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden",
				className
			)}
			data-mobile="true"
			data-sidebar="sidebar"
			data-slot="sidebar"
			{side}
			style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
			bind:ref
		>
			<SheetHeader class="sr-only">
				<SheetTitle>Sidebar</SheetTitle>
				<SheetDescription>Displays the mobile sidebar.</SheetDescription>
			</SheetHeader>
			<div class="flex h-full w-full flex-col">
				{@render children?.()}
			</div>
		</SheetContent>
	</Sheet>
{:else}
	<div
		class="text-sidebar-foreground group peer hidden md:block"
		data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
		data-side={side}
		data-slot="sidebar"
		data-state={sidebar.state}
		data-variant={variant}
		bind:this={ref}
	>
		<!-- This is what handles the sidebar gap on desktop -->
		<div
			class={cn(
				"transition-[width] duration-200 ease-linear relative w-(--sidebar-width) bg-transparent",
				"group-data-[collapsible=offcanvas]:w-0",
				"group-data-[side=right]:rotate-180",
				variant === "floating" || variant === "inset"
					? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
					: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
			)}
			data-slot="sidebar-gap"
		></div>
		<div
			class={cn(
				"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
				side === "left"
					? "start-0 group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)]"
					: "end-0 group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)]",
				// Adjust the padding for floating and inset variants.
				variant === "floating" || variant === "inset"
					? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
					: "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-e group-data-[side=right]:border-s",
				className
			)}
			data-slot="sidebar-container"
			{...restProps}
		>
			<div
				class="bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full flex-col"
				data-sidebar="sidebar"
				data-slot="sidebar-inner"
			>
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
