<script lang="ts" module>
	export type ProductStatusValue = "building" | "launched" | "validating";

	export const PRODUCT_STATUS_LABELS: Record<ProductStatusValue, string> = {
		building: "construindo",
		launched: "lançado",
		validating: "validando",
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";

	let {
		status,
		class: className,
	}: { status: ProductStatusValue; class?: string } = $props();

	const dotStyles: Record<ProductStatusValue, string> = {
		building: "bg-status-building",
		launched: "bg-status-launched",
		validating: "bg-status-validating",
	};
</script>

<span
	class={cn("flex shrink-0 items-center gap-1 text-muted-foreground", className)}
>
	<span class={cn("size-1.5 rounded-full", dotStyles[status])}></span>
	{PRODUCT_STATUS_LABELS[status]}
</span>
