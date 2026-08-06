<script lang="ts">
	import type { Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Drawer,
		DrawerContent,
		DrawerHeader,
		DrawerTitle,
	} from "$lib/components/ui/drawer/index.js";

	let {
		open = $bindable(false),
		title,
		submitLabel,
		canSubmit = true,
		isSaving = false,
		onSubmit,
		children,
	}: {
		open?: boolean;
		title: string;
		submitLabel: string;
		canSubmit?: boolean;
		isSaving?: boolean;
		onSubmit: () => void;
		children: Snippet;
	} = $props();

	function close() {
		open = false;
	}
</script>

<Drawer bind:open>
	<DrawerContent>
		<div
			class="themed-scrollbar mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto"
		>
			<DrawerHeader>
				<DrawerTitle>{title}</DrawerTitle>
			</DrawerHeader>

			<div class="flex flex-col gap-5 px-4 pb-2">
				{@render children()}
			</div>

			<div class="flex items-center justify-end gap-2 px-4 py-4">
				<Button onclick={close} type="button" variant="outline"
					>Cancelar</Button
				>
				<Button
					disabled={!canSubmit || isSaving}
					onclick={onSubmit}
					type="button"
				>
					{isSaving ? "Salvando..." : submitLabel}
				</Button>
			</div>
		</div>
	</DrawerContent>
</Drawer>
