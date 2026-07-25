<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import XIcon from "@lucide/svelte/icons/x";
	import { MAX_PRODUCTS_PER_FOUNDER } from "@matilha-builders/api/lib/constants";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Card } from "$lib/components/ui/card/index.js";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible/index.js";
	import { orpc } from "$lib/orpc";
	import type {
		ProductFormValues,
		ProductStatus,
	} from "./profile-product.types.js";
	import ProfileProductCard from "./profile-product-card.svelte";
	import ProfileProductEditor from "./profile-product-editor.svelte";

	let {
		founderId,
		isOwnProfile,
	}: { founderId: string; isOwnProfile: boolean } = $props();

	const founderQuery = createQuery(() =>
		orpc.founders.get.queryOptions({ input: { founderId } })
	);
	type FounderDataBase = NonNullable<typeof founderQuery.data>;
	type ProductItem = FounderDataBase["products"][number] & { _key?: string };
	type FounderData = Omit<FounderDataBase, "products"> & {
		products: ProductItem[];
	};
	type HistoryData = Awaited<ReturnType<typeof historyQueryData>>;

	const queryClient = useQueryClient();
	let open = $state(true);
	let showAddProduct = $state(false);
	let productPreviews = $state<Record<string, string>>({});

	function founderQueryKey() {
		return orpc.founders.get.queryOptions({ input: { founderId } }).queryKey;
	}

	function historyQueryKey() {
		return orpc.checkIns.listByFounder.infiniteKey({
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor, founderId }),
		});
	}

	function historyQueryData() {
		return queryClient.getQueryData(historyQueryKey());
	}

	function patchFounder(updater: (data: FounderData) => FounderData) {
		queryClient.setQueryData<FounderData>(founderQueryKey(), (current) =>
			current ? updater(current) : current
		);
	}

	async function snapshotAndCancelFounder() {
		await queryClient.cancelQueries({ queryKey: founderQueryKey() });
		return queryClient.getQueryData<FounderData>(founderQueryKey());
	}

	function restoreFounder(snapshot: FounderData | undefined) {
		if (snapshot) {
			queryClient.setQueryData(founderQueryKey(), snapshot);
		}
	}

	function settleOtherCaches() {
		queryClient.invalidateQueries({ queryKey: orpc.founders.list.key() });
		queryClient.invalidateQueries({ queryKey: orpc.products.mine.key() });
		queryClient.invalidateQueries({ queryKey: orpc.checkIns.listFeed.key() });
		queryClient.invalidateQueries({
			queryKey: orpc.checkIns.listByFounder.key(),
		});
	}

	const createProduct = createMutation(() => ({
		...orpc.products.create.mutationOptions(),
		onError: (
			_error,
			_input,
			context:
				| { optimisticId: string; snapshot: FounderData | undefined }
				| undefined
		) => {
			restoreFounder(context?.snapshot);
		},
		onMutate: async (input) => {
			const snapshot = await snapshotAndCancelFounder();
			const optimisticId = `optimistic-${crypto.randomUUID()}`;
			const optimisticProduct: ProductItem = {
				_key: optimisticId,
				createdAt: new Date(),
				founderId,
				icp: input.icp ?? null,
				id: optimisticId,
				imageUrl: null,
				link: input.link || null,
				name: input.name,
				painPoint: input.painPoint ?? null,
				solution: input.solution ?? null,
				status: "validating",
				updatedAt: new Date(),
			} as ProductItem;
			patchFounder((data) => ({
				...data,
				products: [optimisticProduct, ...data.products],
			}));
			showAddProduct = false;
			return { optimisticId, snapshot };
		},
		onSettled: settleOtherCaches,
		onSuccess: (
			data,
			_input,
			context: { optimisticId: string; snapshot: FounderData | undefined }
		) => {
			patchFounder((current) => ({
				...current,
				products: current.products.map((product) =>
					product.id === context.optimisticId
						? { ...(data as ProductItem), _key: context.optimisticId }
						: product
				),
			}));
		},
	}));

	function createProductFromForm(value: ProductFormValues) {
		createProduct.mutate({
			icp: value.icp || undefined,
			link: value.link,
			name: value.name,
			painPoint: value.painPoint || undefined,
			solution: value.solution || undefined,
		});
	}

	function toggleAddProductForm() {
		showAddProduct = !showAddProduct;
	}

	function createProductUpdateMutation() {
		return createMutation(() => ({
			...orpc.products.update.mutationOptions(),
			onError: (
				_error,
				_input,
				context: { snapshot: FounderData | undefined } | undefined
			) => {
				restoreFounder(context?.snapshot);
			},
			onMutate: async (input) => {
				const snapshot = await snapshotAndCancelFounder();
				patchFounder((data) => ({
					...data,
					products: data.products.map((product) =>
						product.id === input.id
							? {
									...product,
									icp: input.icp ?? product.icp,
									link: input.link === "" ? null : (input.link ?? product.link),
									name: input.name ?? product.name,
									painPoint: input.painPoint ?? product.painPoint,
									solution: input.solution ?? product.solution,
									status: input.status ?? product.status,
								}
							: product
					),
				}));
				return { snapshot };
			},
			onSettled: settleOtherCaches,
		}));
	}

	const updateProduct = createProductUpdateMutation();

	function updateProductFromForm(id: string, value: ProductFormValues) {
		updateProduct.mutate({
			icp: value.icp || undefined,
			id,
			link: value.link,
			name: value.name,
			painPoint: value.painPoint || undefined,
			solution: value.solution || undefined,
		});
	}

	const setFeaturedProduct = createMutation(() => ({
		...orpc.founders.setFeaturedProduct.mutationOptions(),
		onError: (
			_error,
			_input,
			context: { snapshot: FounderData | undefined } | undefined
		) => {
			restoreFounder(context?.snapshot);
		},
		onMutate: async (input) => {
			const snapshot = await snapshotAndCancelFounder();
			patchFounder((data) => {
				const featuredIndex = input.productId
					? data.products.findIndex((product) => product.id === input.productId)
					: -1;
				return {
					...data,
					featuredProductId: input.productId,
					products:
						featuredIndex > 0
							? [
									data.products[featuredIndex] as ProductItem,
									...data.products.filter(
										(_, index) => index !== featuredIndex
									),
								]
							: data.products,
				};
			});
			return { snapshot };
		},
		onSettled: settleOtherCaches,
	}));

	function toggleFeatured(productId: string) {
		const currentFeaturedId = founderQuery.data?.featuredProductId ?? null;
		setFeaturedProduct.mutate({
			productId: currentFeaturedId === productId ? null : productId,
		});
	}

	const deleteProduct = createMutation(() => ({
		...orpc.products.delete.mutationOptions(),
		onError: (
			_error,
			_input,
			context:
				| { historySnapshot: HistoryData; snapshot: FounderData | undefined }
				| undefined
		) => {
			restoreFounder(context?.snapshot);
			if (context?.historySnapshot) {
				queryClient.setQueryData(historyQueryKey(), context.historySnapshot);
			}
		},
		onMutate: async (input) => {
			const snapshot = await snapshotAndCancelFounder();
			await queryClient.cancelQueries({ queryKey: historyQueryKey() });
			const historySnapshot = historyQueryData();
			patchFounder((data) => ({
				...data,
				products: data.products.filter((product) => product.id !== input.id),
			}));
			queryClient.setQueryData(historyQueryKey(), (history: HistoryData) =>
				history
					? {
							...history,
							pages: history.pages.map((historyPage) => ({
								...historyPage,
								items: historyPage.items.filter(
									(checkIn) => checkIn.productId !== input.id
								),
							})),
						}
					: history
			);
			return { historySnapshot, snapshot };
		},
		onSettled: settleOtherCaches,
	}));

	function updatePreview(productId: string, url: string | null) {
		if (url) {
			productPreviews = { ...productPreviews, [productId]: url };
			return;
		}
		const nextPreviews = { ...productPreviews };
		Reflect.deleteProperty(nextPreviews, productId);
		productPreviews = nextPreviews;
	}

	function refetchFounder() {
		settleOtherCaches();
		return founderQuery.refetch();
	}
</script>

{#if founderQuery.data}
	{@const founder = founderQuery.data as FounderData}
	<section class="mb-6">
		<Collapsible bind:open>
			<CollapsibleTrigger
				class="group flex w-full cursor-pointer items-center justify-between rounded-lg py-1 text-left"
			>
				<h2
					class="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground"
				>
					Produtos
					<span class="font-normal text-muted-foreground/70">
						({founder.products.length}/{MAX_PRODUCTS_PER_FOUNDER})
					</span>
				</h2>
				<ChevronDownIcon
					class="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent
				class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
			>
				<div class="pt-3">
					{#if isOwnProfile}
						<div class="mb-2.5 flex justify-end">
							{#if founder.products.length < MAX_PRODUCTS_PER_FOUNDER}
								<Button
									onclick={toggleAddProductForm}
									size="sm"
									variant={showAddProduct ? "outline" : "default"}
								>
									{#if showAddProduct}
										<XIcon class="size-3.5" />
										Cancelar
									{:else}
										<PlusIcon class="size-3.5" />
										Novo produto
									{/if}
								</Button>
							{:else}
								<span class="text-xs text-muted-foreground"
									>Limite de {MAX_PRODUCTS_PER_FOUNDER} produtos atingido</span
								>
							{/if}
						</div>
					{/if}
					<AnimatePresence>
						{#if isOwnProfile && showAddProduct && founder.products.length < MAX_PRODUCTS_PER_FOUNDER}
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								initial={{ opacity: 0, y: -6 }}
								key="add-product-panel"
								transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
							>
								<Card class="mb-3 border border-border p-4">
									<ProfileProductEditor
										initialValues={{ icp: "", link: "", name: "", painPoint: "", solution: "" }}
										onSubmit={createProductFromForm}
										submitLabel="Adicionar produto"
									/>
								</Card>
							</motion.div>
						{/if}
					</AnimatePresence>
					{#if founder.products.length}
						<div
							class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 xl:grid-cols-[repeat(auto-fill,minmax(340px,500px))]"
						>
							<AnimatePresence mode="popLayout">
								{#each founder.products as product, index (product._key ?? product.id)}
									<ProfileProductCard
										{index}
										isDeleting={deleteProduct.isPending}
										isFeatured={founder.featuredProductId === product.id}
										{isOwnProfile}
										itemKey={product._key ?? product.id}
										onDelete={(id) => deleteProduct.mutate({ id })}
										onFeature={toggleFeatured}
										onImagePreview={updatePreview}
										onImageUploaded={refetchFounder}
										onStatusChange={(id, status) => updateProduct.mutate({ id, status })}
										onUpdate={updateProductFromForm}
										previewImageUrl={productPreviews[product.id]}
										{product}
									/>
								{/each}
							</AnimatePresence>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">
							{isOwnProfile ? "Cadastra teu primeiro produto." : "Sem produtos ainda."}
						</p>
					{/if}
				</div>
			</CollapsibleContent>
		</Collapsible>
	</section>
{/if}
