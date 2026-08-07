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
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import Field from "./field.svelte";
	import FormTextareaField from "./form-textarea-field.svelte";
	import OptionalCheckInField from "./optional-check-in-field.svelte";
	import ProductSelectCard from "./product-select-card.svelte";

	interface Product {
		id: string;
		imageUrl: string | null;
		link: string | null;
		name: string;
		status: "validating" | "building" | "launched";
	}

	interface Values {
		blocked: string;
		help: string;
		productId: string;
		progress: string;
	}

	interface FormValues extends Values {
		blockedEnabled: boolean;
		helpEnabled: boolean;
	}

	let {
		open = $bindable(false),
		isSaving = false,
		onSave,
		products = [],
	}: {
		open?: boolean;
		isSaving?: boolean;
		onSave: (value: Values) => void;
		products?: Product[];
	} = $props();

	const schema = z
		.object({
			blocked: z.string(),
			blockedEnabled: z.boolean(),
			help: z.string(),
			helpEnabled: z.boolean(),
			productId: z.string().min(1, "Escolhe um produto"),
			progress: z.string().min(1, "Conta o que avançou"),
		})
		.superRefine((value, context) => {
			if (value.blockedEnabled && !value.blocked.trim()) {
				context.addIssue({
					code: "custom",
					message: "Conta o que travou",
					path: ["blocked"],
				});
			}
			if (value.helpEnabled && !value.help.trim()) {
				context.addIssue({
					code: "custom",
					message: "Conta como a comunidade pode ajudar",
					path: ["help"],
				});
			}
		});

	const form = createForm(() => ({
		defaultValues: {
			blocked: "",
			blockedEnabled: false,
			help: "",
			helpEnabled: false,
			productId: "",
			progress: "",
		},
		onSubmit: ({ value }) =>
			onSave({
				blocked: value.blocked,
				help: value.help,
				productId: value.productId,
				progress: value.progress,
			}),
		validators: { onSubmit: schema },
	}));

	// Called before opening: a reactive effect would reset too late, mounting
	// the fields empty.
	export function prime(values: Values) {
		form.reset({
			...values,
			blockedEnabled: Boolean(values.blocked),
			helpEnabled: Boolean(values.help),
		});
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
				class="flex flex-col gap-3 px-4 pb-2"
				onsubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="productId">
					{#snippet children(field)}
						{@const selectedProduct = products.find(
							(product) => product.id === field.state.value
						)}
						<Field label="Sobre qual produto">
							<Select
								onValueChange={(value) => field.handleChange(value ?? "")}
								type="single"
								value={field.state.value}
							>
								<SelectTrigger
									class="min-h-14 w-full data-[size=default]:h-auto"
								>
									{#if selectedProduct}
										<ProductSelectCard product={selectedProduct} />
									{:else}
										<span class="text-muted-foreground">Escolher produto</span>
									{/if}
								</SelectTrigger>
								<SelectContent>
									{#each products as product (product.id)}
										<SelectItem
											class="py-2 pr-9"
											label={product.name}
											value={product.id}
										>
											<ProductSelectCard {product} />
										</SelectItem>
									{/each}
								</SelectContent>
							</Select>
						</Field>
					{/snippet}
				</form.Field>
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
				<form.Field name="blockedEnabled">
					{#snippet children(enabledField)}
						<form.Field name="blocked">
							{#snippet children(field)}
								<OptionalCheckInField
									enabled={enabledField.state.value}
									{field}
									label="Travou nesta semana?"
									onEnabledChange={enabledField.handleChange}
									placeholder="O que te segurou"
									tone="warning"
								/>
							{/snippet}
						</form.Field>
					{/snippet}
				</form.Field>
				<form.Field name="helpEnabled">
					{#snippet children(enabledField)}
						<form.Field name="help">
							{#snippet children(field)}
								<OptionalCheckInField
									enabled={enabledField.state.value}
									{field}
									label="Precisa de ajuda?"
									onEnabledChange={enabledField.handleChange}
									placeholder="Como a matilha pode ajudar?"
									tone="danger"
								/>
							{/snippet}
						</form.Field>
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
