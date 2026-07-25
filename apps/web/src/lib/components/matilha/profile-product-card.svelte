<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import StarIcon from "@lucide/svelte/icons/star";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import Field from "./field.svelte";
	import ImageUploadButton from "./image-upload-button.svelte";
	import ProductChip from "./product-chip.svelte";
	import type {
		ProductFormValues,
		ProductStatus,
		ProfileProduct,
	} from "./profile-product.types.js";
	import ProfileProductEditorDrawer from "./profile-product-editor-drawer.svelte";

	const statusLabels = {
		building: "Construindo",
		launched: "Lançado",
		validating: "Validando",
	} as const;

	let {
		product,
		itemKey,
		index,
		isOwnProfile,
		isFeatured,
		previewImageUrl,
		isDeleting,
		onDelete,
		onFeature,
		onImagePreview,
		onImageUploaded,
		onStatusChange,
		onUpdate,
	}: {
		product: ProfileProduct;
		itemKey: string;
		index: number;
		isOwnProfile: boolean;
		isFeatured: boolean;
		previewImageUrl?: string;
		isDeleting: boolean;
		onDelete: (id: string) => void;
		onFeature: (id: string) => void;
		onImagePreview: (id: string, url: string | null) => void;
		onImageUploaded: () => Promise<unknown>;
		onStatusChange: (id: string, status: ProductStatus) => void;
		onUpdate: (id: string, value: ProductFormValues) => void | Promise<void>;
	} = $props();

	let editOpen = $state(false);
	let confirmingDelete = $state(false);

	function saveProduct(value: ProductFormValues) {
		editOpen = false;
		return onUpdate(product.id, value);
	}

	function cancelDelete() {
		confirmingDelete = false;
	}

	function startEditing() {
		editOpen = true;
	}

	function requestDelete() {
		confirmingDelete = true;
	}
</script>

<motion.div
	animate={{ opacity: 1, scale: 1, y: 0 }}
	class="flex flex-col gap-4 rounded-xl border border-border p-4"
	exit={{ opacity: 0, scale: 0.96 }}
	initial={{ opacity: 0, scale: 0.96, y: 8 }}
	key={itemKey}
	layout
	transition={{
		delay: index * 0.04,
		duration: 0.2,
		ease: [0.23, 1, 0.32, 1],
		layout: { duration: 0.2, ease: [0.77, 0, 0.175, 1] },
	}}
>
	<ProductChip
		product={{ ...product, imageUrl: previewImageUrl ?? product.imageUrl }}
		showStatus={!isOwnProfile}
		size="lg"
		variant="cover"
	/>
	{#if isOwnProfile}
		<Field label="Status">
			<Select
				onValueChange={(value) => onStatusChange(product.id, value as ProductStatus)}
				type="single"
				value={product.status}
			>
				<SelectTrigger class="w-full text-xs" size="sm">
					{statusLabels[product.status]}
				</SelectTrigger>
				<SelectContent>
					<SelectItem label="Validando" value="validating"
						>Validando</SelectItem
					>
					<SelectItem label="Construindo" value="building"
						>Construindo</SelectItem
					>
					<SelectItem label="Lançado" value="launched">Lançado</SelectItem>
				</SelectContent>
			</Select>
		</Field>

		<AnimatePresence mode="wait">
			{#if confirmingDelete}
				<motion.div
					animate={{ opacity: 1 }}
					class="flex items-center gap-2"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
					key="confirm"
					transition={{ duration: 0.15 }}
				>
					<Button
						class="h-8"
						disabled={isDeleting}
						onclick={() => onDelete(product.id)}
						size="sm"
						variant="destructive"
					>
						{isDeleting ? "Excluindo..." : "Confirmar exclusão"}
					</Button>
					<button
						class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
						onclick={cancelDelete}
						type="button"
					>
						cancelar
					</button>
				</motion.div>
			{:else}
				<motion.div
					animate={{ opacity: 1 }}
					class="flex flex-wrap items-center gap-2"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
					key="actions"
					transition={{ duration: 0.15 }}
				>
					<button
						class="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs transition-colors hover:bg-accent"
						onclick={() => onFeature(product.id)}
						title={isFeatured ? "Remover destaque" : "Destacar no board"}
						type="button"
						class:border-streak={isFeatured}
						class:text-streak={isFeatured}
					>
						<StarIcon
							class="size-3.5"
							fill={isFeatured ? "currentColor" : "none"}
						/>
						{isFeatured ? "Produto destacado" : "Destacar produto"}
					</button>
					<div class="ml-auto flex items-center gap-2">
						<ImageUploadButton
							endpoint="productImageUploader"
							iconOnly
							input={{ productId: product.id }}
							label="Trocar foto do produto"
							onPreview={(url) => onImagePreview(product.id, url)}
							onUploaded={onImageUploaded}
						/>
						<button
							aria-label="Editar produto"
							class="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent"
							onclick={startEditing}
							title="Editar produto"
							type="button"
						>
							<PencilIcon class="size-3.5" />
						</button>
						<button
							aria-label="Excluir produto"
							class="flex size-8 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10"
							onclick={requestDelete}
							title="Excluir produto"
							type="button"
						>
							<Trash2Icon class="size-3.5" />
						</button>
					</div>
				</motion.div>
			{/if}
		</AnimatePresence>

		<ProfileProductEditorDrawer
			initialValues={{
				icp: product.icp ?? "",
				link: product.link ?? "",
				name: product.name,
				painPoint: product.painPoint ?? "",
				solution: product.solution ?? "",
			}}
			onSave={saveProduct}
			bind:open={editOpen}
		/>
	{/if}
</motion.div>
