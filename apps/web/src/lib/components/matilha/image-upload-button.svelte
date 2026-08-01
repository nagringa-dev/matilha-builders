<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import type { Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { createUploadThing } from "$lib/uploadthing";

	let {
		endpoint,
		label,
		onUploaded,
		onPreview,
		input,
		iconOnly = false,
		overlay = false,
		children,
	}: {
		endpoint: "avatarUploader" | "productImageUploader";
		label: string;
		onUploaded: () => Promise<unknown> | undefined;
		onPreview?: (url: string | null) => void;
		input?: { productId: string };
		iconOnly?: boolean;
		overlay?: boolean;
		children?: Snippet;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let objectUrl: string | undefined;

	function clearPreview() {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = undefined;
		}
		onPreview?.(null);
	}

	// endpoint is fixed per component instance (used as a hook config, not reactive state).
	// svelte-ignore state_referenced_locally
	const { startUpload, isUploading } = createUploadThing(endpoint, {
		onClientUploadComplete: async () => {
			await onUploaded();
			clearPreview();
		},
		onUploadError: (error) => {
			clearPreview();
			console.error(error.message);
		},
	});

	function handleChange(e: Event) {
		const { files } = e.target as HTMLInputElement;
		if (files && files.length > 0) {
			objectUrl = URL.createObjectURL(files[0] as File);
			onPreview?.(objectUrl);
			// biome-ignore lint/suspicious/noExplicitAny: startUpload's input type varies per endpoint.
			startUpload(Array.from(files), input as any);
		}
	}
</script>

<input
	accept="image/*"
	class="hidden"
	onchange={handleChange}
	type="file"
	bind:this={fileInput}
>
{#if overlay}
	<button
		aria-label={label}
		class="group/avatar relative rounded-full disabled:pointer-events-none"
		disabled={$isUploading}
		onclick={() => fileInput?.click()}
		title={label}
		type="button"
	>
		{@render children?.()}
		<span
			class="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-[background-color,opacity] duration-200 group-hover/avatar:bg-black/50 group-hover/avatar:opacity-100"
		>
			<AnimatePresence mode="wait">
				{#if $isUploading}
					<motion.span
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.92 }}
						initial={{ opacity: 0, scale: 0.92 }}
						key="loading"
						transition={{ duration: 0.15 }}
					>
						<LoaderCircleIcon class="size-4 animate-spin text-white" />
					</motion.span>
				{:else}
					<motion.span
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.92 }}
						initial={{ opacity: 0, scale: 0.92 }}
						key="pencil"
						transition={{ duration: 0.15 }}
					>
						<PencilIcon class="size-4 text-white" />
					</motion.span>
				{/if}
			</AnimatePresence>
		</span>
	</button>
{:else if iconOnly}
	<button
		aria-label={label}
		class="flex size-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
		disabled={$isUploading}
		onclick={() => fileInput?.click()}
		title={label}
		type="button"
	>
		<AnimatePresence mode="wait">
			{#if $isUploading}
				<motion.span
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.92 }}
					initial={{ opacity: 0, scale: 0.92 }}
					key="loading"
					transition={{ duration: 0.15 }}
				>
					<LoaderCircleIcon class="size-3.5 animate-spin" />
				</motion.span>
			{:else}
				<motion.span
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.92 }}
					initial={{ opacity: 0, scale: 0.92 }}
					key="add"
					transition={{ duration: 0.15 }}
				>
					<ImagePlusIcon class="size-3.5" />
				</motion.span>
			{/if}
		</AnimatePresence>
	</button>
{:else}
	<Button
		disabled={$isUploading}
		onclick={() => fileInput?.click()}
		size="sm"
		type="button"
		variant="outline"
	>
		{$isUploading ? "Enviando..." : label}
	</Button>
{/if}
