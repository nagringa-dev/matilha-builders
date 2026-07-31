<script lang="ts">
	import StarIcon from "@lucide/svelte/icons/star";
	import ProductChip from "./product-chip.svelte";
	import type { ProfileProduct } from "./profile-product.types.js";

	let { product }: { product: ProfileProduct } = $props();
</script>

<div class="mb-6 rounded-lg border border-streak/30 bg-streak/5 px-3 py-2.5">
	<div
		class="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-streak"
	>
		<StarIcon class="size-3" fill="currentColor" />
		Produto em destaque
	</div>
	<ProductChip {product} size="sm" variant="tile" />
</div>
