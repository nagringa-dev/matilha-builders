<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import { computeNextStreak } from "@matilha-builders/api/lib/streak";
	import { createForm } from "@tanstack/svelte-form";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { z } from "zod";
	import { authClient } from "$lib/auth-client";
	import CheckInSuccessState from "$lib/components/matilha/check-in-success-state.svelte";
	import Field from "$lib/components/matilha/field.svelte";
	import FormTextareaField from "$lib/components/matilha/form-textarea-field.svelte";

	import OptionalCheckInField from "$lib/components/matilha/optional-check-in-field.svelte";
	import ProductSelectCard from "$lib/components/matilha/product-select-card.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Card } from "$lib/components/ui/card/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from "$lib/components/ui/select/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { orpc } from "$lib/orpc";

	const sessionQuery = authClient.useSession();
	const currentUserId = $derived($sessionQuery.data?.user.id ?? "");
	const productsQuery = createQuery(() => orpc.products.mine.queryOptions());
	const founderQuery = createQuery(() => ({
		...orpc.founders.get.queryOptions({ input: { founderId: currentUserId } }),
		enabled: !!currentUserId,
	}));
	const queryClient = useQueryClient();

	let showSuccess = $state(false);
	let optimisticStreak = $state(0);
	let submitError = $state(false);

	interface ProductRef {
		createdAt: Date;
		founderId: string;
		icp: string | null;
		id: string;
		imageUrl: string | null;
		link: string | null;
		name: string;
		painPoint: string | null;
		solution: string | null;
		status: "building" | "launched" | "validating";
		updatedAt: Date;
	}
	interface FeedItem {
		avatarUrl: string | null;
		blocked: string;
		createdAt: Date;
		dismissedAt: Date | null;
		founderId: string;
		hasVoted: boolean;
		help: string | null;
		id: string;
		name: string;
		product: ProductRef | null;
		progress: string;
		streak: number;
		voteCount: number;
	}
	interface HistoryItem {
		blocked: string;
		createdAt: Date;
		dismissedAt: Date | null;
		founderId: string;
		help: string | null;
		id: string;
		product: ProductRef | null;
		productId: string | null;
		progress: string;
	}

	interface Page<T> {
		items: T[];
		nextCursor: number | undefined;
	}
	interface Paginated<T> {
		pageParams: number[];
		pages: Page<T>[];
	}

	function feedKey() {
		return orpc.checkIns.listFeed.infiniteKey({
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor }),
		});
	}
	function historyKey(founderId: string) {
		return orpc.checkIns.listByFounder.infiniteKey({
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor, founderId }),
		});
	}

	function prependToFirstPage<T>(
		data: Paginated<T> | undefined,
		item: T
	): Paginated<T> | undefined {
		if (!data || data.pages.length === 0) {
			return data;
		}
		const [firstPage, ...restPages] = data.pages;
		if (!firstPage) {
			return data;
		}
		return {
			...data,
			pages: [
				{ ...firstPage, items: [item, ...firstPage.items] },
				...restPages,
			],
		};
	}

	const postCheckIn = createMutation(() => ({
		...orpc.checkIns.create.mutationOptions(),
		meta: { skipErrorToast: true },
		onError: (
			_error,
			_input,
			context:
				| {
						feedSnapshot: Paginated<FeedItem> | undefined;
						founderId: string;
						historySnapshot: Paginated<HistoryItem> | undefined;
				  }
				| undefined
		) => {
			if (!context) {
				return;
			}
			if (context.feedSnapshot) {
				queryClient.setQueryData(feedKey(), context.feedSnapshot);
			}
			if (context.historySnapshot) {
				queryClient.setQueryData(
					historyKey(context.founderId),
					context.historySnapshot
				);
			}
			showSuccess = false;
			submitError = true;
		},
		onMutate: async (input) => {
			const founderId = $sessionQuery.data?.user.id ?? "";
			submitError = false;
			optimisticStreak = computeNextStreak(
				founderQuery.data?.streak ?? 0,
				founderQuery.data?.lastCheckInAt ?? null,
				new Date()
			);
			showSuccess = true;
			await queryClient.cancelQueries({ queryKey: feedKey() });
			await queryClient.cancelQueries({ queryKey: historyKey(founderId) });
			const feedSnapshot = queryClient.getQueryData<Paginated<FeedItem>>(
				feedKey()
			);
			const historySnapshot = queryClient.getQueryData<Paginated<HistoryItem>>(
				historyKey(founderId)
			);
			const product =
				(input.productId &&
					productsQuery.data?.find((p) => p.id === input.productId)) ||
				null;
			const optimisticId = `optimistic-${crypto.randomUUID()}`;
			const createdAt = new Date();
			queryClient.setQueryData<Paginated<FeedItem>>(feedKey(), (old) =>
				prependToFirstPage(old, {
					avatarUrl: null,
					blocked: input.blocked,
					createdAt,
					dismissedAt: null,
					founderId,
					hasVoted: false,
					help: input.help ?? null,
					id: optimisticId,
					name: $sessionQuery.data?.user.name ?? "",
					product,
					progress: input.progress,
					streak: 0,
					voteCount: 0,
				})
			);
			queryClient.setQueryData<Paginated<HistoryItem>>(
				historyKey(founderId),
				(old) =>
					prependToFirstPage(old, {
						blocked: input.blocked,
						createdAt,
						dismissedAt: null,
						founderId,
						help: input.help ?? null,
						id: optimisticId,
						product,
						productId: input.productId ?? null,
						progress: input.progress,
					})
			);
			return { feedSnapshot, founderId, historySnapshot };
		},
		// Broad `.key()` partial-match invalidation: this page doesn't render
		// any of these, so there's no risk of racing an optimistic patch —
		// just make sure feed/board/profile pick up the new check-in and
		// streak next time they're viewed.
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: orpc.checkIns.listFeed.key() });
			queryClient.invalidateQueries({
				queryKey: orpc.checkIns.listByFounder.key(),
			});
			queryClient.invalidateQueries({ queryKey: orpc.founders.get.key() });
			queryClient.invalidateQueries({ queryKey: orpc.founders.list.key() });
		},
	}));

	const validationSchema = z
		.object({
			blocked: z.string(),
			blockedEnabled: z.boolean(),
			help: z.string(),
			helpEnabled: z.boolean(),
			productId: z.string(),
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
		onSubmit: ({ value }) => {
			// Fire-and-forget: the mutation is optimistic (see postCheckIn.onMutate),
			// so the success screen appears instantly instead of waiting on the
			// network round-trip. Awaiting mutateAsync here would keep the submit
			// button's isSubmitting (and its "Postando..." label) on until the
			// request resolves, defeating the point of being optimistic.
			postCheckIn.mutate({
				blocked: value.blocked,
				help: value.help || undefined,
				productId: value.productId || undefined,
				progress: value.progress,
			});
		},
		validators: {
			onSubmit: validationSchema,
		},
	}));

	type SubmitState = Pick<typeof form.state, "canSubmit" | "isSubmitting">;

	// With a single product there's nothing to pick, so fill the field as soon
	// as the list loads instead of making the founder open the select. Plain
	// `let` rather than `$state` on purpose: it's a memo to keep the effect from
	// re-applying, not something the UI reads.
	let autoSelectedProductId: string | null = null;
	$effect(() => {
		const products = productsQuery.data;
		if (products?.length !== 1) {
			return;
		}
		const [onlyProduct] = products;
		if (!onlyProduct || autoSelectedProductId === onlyProduct.id) {
			return;
		}
		autoSelectedProductId = onlyProduct.id;
		form.setFieldValue("productId", onlyProduct.id);
	});
</script>

{#if showSuccess}
	<CheckInSuccessState streak={postCheckIn.data?.streak ?? optimisticStreak} />
{:else}
	<div class="mx-auto max-w-2xl px-4 py-8 md:px-6">
		<div class="mb-6 border-border border-b pb-5">
			<h1 class="text-2xl font-bold tracking-tight">Check-in da semana</h1>
			<p class="mt-1 text-sm text-muted-foreground">Rápido e direto ao ponto</p>
		</div>
		{#if productsQuery.isPending}
			<Loader
				size="sm"
				subtitle="Preparando o formulário"
				title="Carregando o check-in..."
			/>
		{:else}
			<Card class="border border-border p-4">
				<AnimatePresence>
					{#if submitError}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							class="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
							exit={{ opacity: 0, y: -6 }}
							initial={{ opacity: 0, y: -6 }}
							key="submit-error"
							role="alert"
							transition={{ duration: 0.2 }}
						>
							Não deu pra postar o check-in. Tenta de novo.
						</motion.div>
					{/if}
				</AnimatePresence>
				<form
					class="flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{#if productsQuery.data && productsQuery.data.length > 0}
						{@const products = productsQuery.data}
						<form.Field name="productId">
							{#snippet children(field)}
								{@const selectedProduct = products.find(
									(product) => product.id === field.state.value
								)}
								<Field label="Sobre qual produto">
									<Select
										onValueChange={(v) => field.handleChange(v ?? "")}
										type="single"
										value={field.state.value}
									>
										<SelectTrigger
											class="min-h-14 w-full data-[size=default]:h-auto"
										>
											{#if selectedProduct}
												<ProductSelectCard product={selectedProduct} />
											{:else}
												<span class="text-muted-foreground"
													>Escolher produto</span
												>
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
					{:else if productsQuery.isSuccess}
						<p class="text-xs text-muted-foreground">
							Você ainda não tem produtos cadastrados.
							<a
								class="underline underline-offset-2"
								href="/profile/{$sessionQuery.data?.user.id}"
							>
								Cadastra um no seu perfil</a
							>
							pra poder postar um check-in.
						</p>
					{/if}

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
							<Button
								disabled={!state.canSubmit ||
									state.isSubmitting ||
									!productsQuery.data?.length}
								type="submit"
							>
								{state.isSubmitting ? "Postando..." : "Postar"}
							</Button>
						{/snippet}
					</form.Subscribe>
				</form>
			</Card>
		{/if}
	</div>
{/if}
