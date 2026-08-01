<script lang="ts">
	import { createForm } from "@tanstack/svelte-form";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Drawer,
		DrawerClose,
		DrawerContent,
		DrawerFooter,
		DrawerHeader,
		DrawerTitle,
	} from "$lib/components/ui/drawer/index.js";
	import FormTextareaField from "./form-textarea-field.svelte";

	interface Values {
		blocked: string;
		help: string;
		progress: string;
	}

	let {
		open = $bindable(false),
		isSaving = false,
		onSave,
	}: {
		open?: boolean;
		isSaving?: boolean;
		onSave: (value: Values) => void;
	} = $props();

	const schema = z.object({
		blocked: z.string().min(1, "Conta o que travou"),
		help: z.string(),
		progress: z.string().min(1, "Conta o que avançou"),
	});

	const form = createForm(() => ({
		defaultValues: { blocked: "", help: "", progress: "" },
		onSubmit: ({ value }) => onSave(value),
		validators: { onSubmit: schema },
	}));

	// Called before opening: a reactive effect would reset too late, mounting
	// the fields empty.
	export function prime(values: Values) {
		form.reset(values);
	}

	type SubmitState = Pick<typeof form.state, "canSubmit" | "isSubmitting">;
</script>

<Drawer bind:open>
	<DrawerContent>
		<div
			class="themed-scrollbar mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto"
		>
			<DrawerHeader>
				<DrawerTitle>Editar check-in</DrawerTitle>
			</DrawerHeader>
			<form
				class="flex flex-col gap-4 px-4 pb-2"
				onsubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="progress">
					{#snippet children(field)}
						<FormTextareaField
							{field}
							label="O que avançou essa semana"
							placeholder="Shipei, vendi, aprendi..."
							rows={3}
						/>
					{/snippet}
				</form.Field>
				<form.Field name="blocked">
					{#snippet children(field)}
						<FormTextareaField
							{field}
							label="O que travou"
							placeholder="O que te segurou"
							rows={3}
						/>
					{/snippet}
				</form.Field>
				<form.Field name="help">
					{#snippet children(field)}
						<FormTextareaField
							{field}
							hint="opcional"
							label="No que precisa de ajuda"
							placeholder="A matilha te ajuda"
							rows={2}
							showError={false}
						/>
					{/snippet}
				</form.Field>
				<form.Subscribe
					selector={(state: typeof form.state): SubmitState => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{#snippet children(state: SubmitState)}
						<Button disabled={!state.canSubmit || isSaving} type="submit">
							{isSaving ? "Salvando..." : "Salvar"}
						</Button>
					{/snippet}
				</form.Subscribe>
			</form>
			<DrawerFooter>
				<DrawerClose
					class="h-9 w-full rounded-md border border-border text-sm transition-colors hover:bg-accent"
				>
					Cancelar
				</DrawerClose>
			</DrawerFooter>
		</div>
	</DrawerContent>
</Drawer>
