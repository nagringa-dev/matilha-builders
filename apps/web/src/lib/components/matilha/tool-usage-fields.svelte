<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import { createQuery } from "@tanstack/svelte-query";
	import { authClient } from "$lib/auth-client";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { orpc } from "$lib/orpc";
	import { cn } from "$lib/utils.js";
	import Field from "./field.svelte";
	import ProductChip from "./product-chip.svelte";

	let {
		note = $bindable(""),
		productIds = $bindable([]),
		enabled = true,
	}: {
		note?: string;
		productIds?: string[];
		enabled?: boolean;
	} = $props();

	const sessionQuery = authClient.useSession();
	const founderId = $derived($sessionQuery.data?.user.id ?? "");

	const productsQuery = createQuery(() => ({
		...orpc.products.mine.queryOptions(),
		enabled,
	}));

	function toggleProduct(productId: string) {
		productIds = productIds.includes(productId)
			? productIds.filter((id) => id !== productId)
			: [...productIds, productId];
	}
</script>

<Field hint="opcional" htmlFor="tool-note" label="Por que você usa?">
	<Textarea
		id="tool-note"
		placeholder="Ex.: zoom automático economiza horas de edição..."
		rows={3}
		bind:value={note}
	/>
</Field>

<Field label="Em quais produtos você usa?">
	{#if productsQuery.data?.length}
		<div class="flex flex-wrap gap-1.5">
			{#each productsQuery.data as product (product.id)}
				{@const selected = productIds.includes(product.id)}
				<button
					class="cursor-pointer rounded-full"
					onclick={() => toggleProduct(product.id)}
					type="button"
				>
					<ProductChip
						class={cn(
							"transition-colors",
							selected
								? "border-streak/30 bg-streak/12 text-streak"
								: "text-muted-foreground hover:text-foreground"
						)}
						{product}
						showLink={false}
						variant="tag"
					>
						{#snippet trailing()}
							{#if selected}
								<CheckIcon class="size-3 shrink-0" />
							{/if}
						{/snippet}
					</ProductChip>
				</button>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-muted-foreground">
			Você ainda não cadastrou produtos.
			{#if founderId}
				<a
					class="underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-streak"
					href="/profile/{founderId}?tab=produtos"
				>
					Cadastrar um produto
				</a>
			{/if}
		</p>
	{/if}
</Field>
