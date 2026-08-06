<script lang="ts">
	import {
		TOOL_CATEGORIES,
		type ToolCategorySlug,
		toolCategoryLabel,
	} from "@matilha-builders/db/tool-categories";
	import { createMutation, useQueryClient } from "@tanstack/svelte-query";
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

	let {
		open = $bindable(false),
		tool,
	}: {
		open?: boolean;
		/** The shared catalog entry, not the viewer's own usage. */
		tool: {
			category: string;
			description: string | null;
			id: string;
			name: string;
		};
	} = $props();

	const queryClient = useQueryClient();

	let name = $state("");
	let category = $state<ToolCategorySlug | "">("");
	let description = $state("");

	$effect(() => {
		if (open) {
			const {
				category: saved,
				description: savedDescription,
				name: savedName,
			} = tool;
			name = savedName;
			category = saved as ToolCategorySlug;
			description = savedDescription ?? "";
		}
	});

	const updateTool = createMutation(() => ({
		...orpc.tools.updateTool.mutationOptions(),
		onSettled: () => invalidateToolCaches(queryClient),
		onSuccess: () => {
			open = false;
		},
	}));

	function submit() {
		if (!category) {
			return;
		}
		updateTool.mutate({
			category,
			description: description.trim() || undefined,
			name: name.trim(),
			toolId: tool.id,
		});
	}
</script>

<ToolFormDrawer
	canSubmit={!!name.trim() && !!category}
	isSaving={updateTool.isPending}
	onSubmit={submit}
	submitLabel="Salvar"
	title="Editar informações"
	bind:open
>
	<Field htmlFor="edit-tool-name" label="Nome">
		<Input id="edit-tool-name" bind:value={name} />
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
	<Field hint="opcional" htmlFor="edit-tool-description" label="Descrição">
		<Textarea id="edit-tool-description" rows={3} bind:value={description} />
	</Field>
</ToolFormDrawer>
