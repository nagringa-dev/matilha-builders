<script lang="ts">
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import {
		TOOL_CATEGORIES,
		type ToolCategorySlug,
		toolCategoryLabel,
	} from "@matilha-builders/db/tool-categories";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { Input } from "$lib/components/ui/input/index.js";
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { orpc } from "$lib/orpc";
	import { invalidateToolCaches } from "$lib/tool-cache";
	import Field from "./field.svelte";
	import ToolFormDrawer from "./tool-form-drawer.svelte";
	import ToolLogo from "./tool-logo.svelte";
	import ToolUsageFields from "./tool-usage-fields.svelte";

	let {
		open = $bindable(false),
		initialUrl = "",
		onSaved,
	}: {
		open?: boolean;
		initialUrl?: string;
		onSaved?: (result: { slug: string; toolId: string }) => void;
	} = $props();

	const queryClient = useQueryClient();

	let url = $state("");
	let debouncedUrl = $state("");
	let name = $state("");
	let category = $state<ToolCategorySlug | "">("");
	let description = $state("");
	let note = $state("");
	let productIds = $state<string[]>([]);

	$effect(() => {
		if (open) {
			url = initialUrl;
			debouncedUrl = initialUrl;
			name = "";
			category = "";
			description = "";
			note = "";
			productIds = [];
			syncedToolId = null;
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
		enabled: open && debouncedUrl.trim().length > 0,
	}));

	// Pasting a URL already in the stack turns this into an edit. Never load
	// over something already typed.
	let syncedToolId = $state<string | null>(null);
	$effect(() => {
		const adoption = lookupQuery.data?.adoption;
		if (!adoption || syncedToolId === adoption.toolId) {
			return;
		}
		const { note: savedNote, productIds: savedProductIds, toolId } = adoption;
		syncedToolId = toolId;
		if (!note.trim()) {
			note = savedNote ?? "";
		}
		if (productIds.length === 0) {
			productIds = savedProductIds;
		}
	});

	const foundTool = $derived(lookupQuery.data?.tool ?? null);
	const hasUrl = $derived(debouncedUrl.trim().length > 0);
	const isResolving = $derived(hasUrl && lookupQuery.isFetching);
	const isNewTool = $derived(hasUrl && !(isResolving || foundTool));
	const alreadyInStack = $derived(!!lookupQuery.data?.adoption);

	const addToStack = createMutation(() => ({
		...orpc.tools.addToStack.mutationOptions(),
		onSettled: () => invalidateToolCaches(queryClient),
		onSuccess: (result) => {
			open = false;
			onSaved?.(result);
		},
	}));

	const canSubmit = $derived(
		hasUrl && !isResolving && (!!foundTool || (!!name.trim() && !!category))
	);

	function submit() {
		addToStack.mutate(
			isNewTool && category
				? {
						category,
						description: description.trim() || undefined,
						kind: "new",
						name: name.trim(),
						note: note.trim() || undefined,
						productIds,
						url,
					}
				: {
						kind: "existing",
						note: note.trim() || undefined,
						productIds,
						url,
					}
		);
	}
</script>

<ToolFormDrawer
	{canSubmit}
	isSaving={addToStack.isPending}
	onSubmit={submit}
	submitLabel={alreadyInStack ? "Salvar" : "Adicionar à stack"}
	title={alreadyInStack ? "Editar na sua stack" : "Adicionar à sua stack"}
	bind:open
>
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
			<ToolLogo logoUrl={foundTool.logoUrl} name={foundTool.name} size="md" />
			<div class="min-w-0">
				<p class="truncate text-sm font-semibold">{foundTool.name}</p>
				<p class="truncate text-xs text-muted-foreground">
					{toolCategoryLabel(foundTool.category)}
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
					category = value as ToolCategorySlug;
				}}
				type="single"
				value={category}
			>
				<SelectTrigger class="w-full">
					{category ? toolCategoryLabel(category) : "Selecione"}
				</SelectTrigger>
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

	<ToolUsageFields enabled={open} bind:note bind:productIds />
</ToolFormDrawer>
