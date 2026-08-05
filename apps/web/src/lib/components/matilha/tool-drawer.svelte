<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import {
		TOOL_CATEGORIES,
		toolCategoryLabel,
	} from "@matilha-builders/db/tool-categories";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { authClient } from "$lib/auth-client";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Drawer,
		DrawerContent,
		DrawerHeader,
		DrawerTitle,
	} from "$lib/components/ui/drawer/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { orpc } from "$lib/orpc";
	import { cn } from "$lib/utils.js";
	import Field from "./field.svelte";
	import ProductChip from "./product-chip.svelte";
	import ToolLogo from "./tool-logo.svelte";

	let {
		open = $bindable(false),
		adoption = null,
		initialUrl = "",
		onSaved,
	}: {
		open?: boolean;
		adoption?: {
			note: string | null;
			productIds: string[];
			toolId: string;
		} | null;
		initialUrl?: string;
		onSaved?: (result: { slug: string; toolId: string }) => void;
	} = $props();

	const isEditing = $derived(!!adoption);
	const queryClient = useQueryClient();
	const sessionQuery = authClient.useSession();
	const founderId = $derived($sessionQuery.data?.user.id ?? "");

	let url = $state("");
	let debouncedUrl = $state("");
	let name = $state("");
	let category = $state("");
	let description = $state("");
	let note = $state("");
	let selectedProductIds = $state<string[]>([]);
	let prefilledToolId = $state<string | null>(null);

	$effect(() => {
		if (open) {
			url = initialUrl;
			debouncedUrl = initialUrl;
			name = "";
			category = "";
			description = "";
			note = adoption?.note ?? "";
			selectedProductIds = adoption?.productIds ?? [];
			prefilledToolId = null;
		}
	});

	$effect(() => {
		const value = url;
		const timer = setTimeout(() => {
			debouncedUrl = value;
		}, 400);
		return () => clearTimeout(timer);
	});

	const lookupQuery = createQuery(() => ({
		...orpc.tools.lookup.queryOptions({ input: { url: debouncedUrl } }),
		enabled: !isEditing && debouncedUrl.trim().length > 0,
	}));

	const productsQuery = createQuery(() => ({
		...orpc.products.mine.queryOptions(),
		enabled: open,
	}));

	$effect(() => {
		const found = lookupQuery.data;
		if (isEditing || !found?.tool || prefilledToolId === found.tool.id) {
			return;
		}
		prefilledToolId = found.tool.id;
		if (found.adoption) {
			note = found.adoption.note ?? "";
			selectedProductIds = found.adoption.productIds;
		}
	});

	const foundTool = $derived(lookupQuery.data?.tool ?? null);
	const existingAdoption = $derived(lookupQuery.data?.adoption ?? null);
	const alreadyInStack = $derived(isEditing || !!existingAdoption);
	const hasUrl = $derived(debouncedUrl.trim().length > 0);
	const isResolving = $derived(hasUrl && lookupQuery.isFetching);
	const isNewTool = $derived(hasUrl && !(isResolving || foundTool));
	const categoryLabel = $derived(
		category ? toolCategoryLabel(category) : "Selecione"
	);
	const foundCategoryLabel = $derived(
		foundTool ? toolCategoryLabel(foundTool.category) : ""
	);
	const canSubmit = $derived(
		isEditing ||
			(hasUrl && !isResolving && (foundTool || (name.trim() && category)))
	);

	function settleCaches() {
		queryClient.invalidateQueries({ queryKey: orpc.tools.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.tools.get.key() });
		queryClient.invalidateQueries({ queryKey: orpc.tools.byFounder.key() });
	}

	const addToStack = createMutation(() => ({
		...orpc.tools.addToStack.mutationOptions(),
		onSettled: settleCaches,
		onSuccess: (result) => {
			open = false;
			onSaved?.(result);
		},
	}));

	const updateStack = createMutation(() => ({
		...orpc.tools.updateStack.mutationOptions(),
		onSettled: settleCaches,
		onSuccess: () => {
			open = false;
		},
	}));

	const isSaving = $derived(addToStack.isPending || updateStack.isPending);

	function closeDrawer() {
		open = false;
	}

	function toggleProduct(productId: string) {
		selectedProductIds = selectedProductIds.includes(productId)
			? selectedProductIds.filter((id) => id !== productId)
			: [...selectedProductIds, productId];
	}

	function submit() {
		if (adoption) {
			updateStack.mutate({
				note: note.trim() || undefined,
				productIds: selectedProductIds,
				toolId: adoption.toolId,
			});
			return;
		}
		addToStack.mutate({
			category: isNewTool
				? (category as (typeof TOOL_CATEGORIES)[number]["slug"])
				: undefined,
			description: isNewTool ? description.trim() || undefined : undefined,
			name: isNewTool ? name.trim() : undefined,
			note: note.trim() || undefined,
			productIds: selectedProductIds,
			url,
		});
	}
</script>

<Drawer bind:open>
	<DrawerContent>
		<div
			class="themed-scrollbar mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto"
		>
			<DrawerHeader>
				<DrawerTitle>
					{alreadyInStack ? "Editar na sua stack" : "Adicionar à sua stack"}
				</DrawerTitle>
			</DrawerHeader>

			<div class="flex flex-col gap-5 px-4 pb-2">
				{#if !isEditing}
					<Field
						hint="Preenchido automaticamente quando a ferramenta já existe."
						htmlFor="tool-url"
						label="Link da ferramenta"
					>
						<Input
							autocomplete="off"
							id="tool-url"
							placeholder="ex.: screen.studio"
							bind:value={url}
						/>
					</Field>

					{#if isResolving}
						<p class="flex items-center gap-2 text-xs text-muted-foreground">
							<LoaderCircleIcon class="size-3.5 animate-spin" />
							Procurando ferramenta...
						</p>
					{:else if foundTool}
						<div
							class="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3"
						>
							<ToolLogo
								logoUrl={foundTool.logoUrl}
								name={foundTool.name}
								size="md"
							/>
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold">{foundTool.name}</p>
								<p class="truncate text-xs text-muted-foreground">
									{foundCategoryLabel}
								</p>
							</div>
						</div>
					{:else if isNewTool}
						<Field htmlFor="tool-name" label="Nome">
							<Input
								id="tool-name"
								placeholder="ex.: Screen Studio"
								bind:value={name}
							/>
						</Field>
						<Field label="Categoria">
							<Select
								onValueChange={(value) => {
									category = value;
								}}
								type="single"
								value={category}
							>
								<SelectTrigger class="w-full">{categoryLabel}</SelectTrigger>
								<SelectContent>
									{#each TOOL_CATEGORIES as entry (entry.slug)}
										<SelectItem label={entry.label} value={entry.slug}>
											{entry.label}
										</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</Field>
						<Field hint="opcional" htmlFor="tool-description" label="Descrição">
							<Textarea
								id="tool-description"
								placeholder="O que essa ferramenta faz?"
								rows={2}
								bind:value={description}
							/>
						</Field>
					{/if}
				{/if}

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
								{@const selected = selectedProductIds.includes(product.id)}
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
			</div>

			<div class="flex items-center justify-end gap-2 px-4 py-4">
				<Button onclick={closeDrawer} type="button" variant="outline">
					Cancelar
				</Button>
				<Button
					disabled={!canSubmit || isSaving}
					onclick={submit}
					type="button"
				>
					{#if isSaving}
						Salvando...
					{:else}
						{alreadyInStack ? "Salvar" : "Adicionar à stack"}
					{/if}
				</Button>
			</div>
		</div>
	</DrawerContent>
</Drawer>
