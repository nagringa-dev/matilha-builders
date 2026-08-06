<script lang="ts">
	import { createMutation, useQueryClient } from "@tanstack/svelte-query";
	import { orpc } from "$lib/orpc";
	import { invalidateToolCaches } from "$lib/tool-cache";
	import ToolFormDrawer from "./tool-form-drawer.svelte";
	import ToolUsageFields from "./tool-usage-fields.svelte";

	let {
		open = $bindable(false),
		adoption,
	}: {
		open?: boolean;
		adoption: { note: string | null; productIds: string[]; toolId: string };
	} = $props();

	const queryClient = useQueryClient();

	let note = $state("");
	let productIds = $state<string[]>([]);

	$effect(() => {
		if (open) {
			const { note: savedNote, productIds: savedProductIds } = adoption;
			note = savedNote ?? "";
			productIds = savedProductIds;
		}
	});

	const updateStack = createMutation(() => ({
		...orpc.tools.updateStack.mutationOptions(),
		onSettled: () => invalidateToolCaches(queryClient),
		onSuccess: () => {
			open = false;
		},
	}));

	function submit() {
		updateStack.mutate({
			note: note.trim() || undefined,
			productIds,
			toolId: adoption.toolId,
		});
	}
</script>

<ToolFormDrawer
	isSaving={updateStack.isPending}
	onSubmit={submit}
	submitLabel="Salvar"
	title="Editar na sua stack"
	bind:open
>
	<ToolUsageFields enabled={open} bind:note bind:productIds />
</ToolFormDrawer>
