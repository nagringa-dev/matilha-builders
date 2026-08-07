<script lang="ts">
	import { motion } from "@humanspeak/svelte-motion";
	import FlagIcon from "@lucide/svelte/icons/flag";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import { EDIT_WINDOW_MS } from "@matilha-builders/api/lib/streak";
	import {
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger,
	} from "$lib/components/ui/alert-dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { toast } from "$lib/components/ui/sonner/index.js";
	import {
		Tooltip,
		TooltipContent,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip/index.js";
	import { formatRelative } from "$lib/format";
	import { orpc } from "$lib/orpc";
	import Avatar from "./avatar.svelte";
	import CheckInEditor from "./check-in-editor.svelte";
	import ProductChip from "./product-chip.svelte";

	interface Product {
		id: string;
		imageUrl: string | null;
		link: string | null;
		name: string;
		status: "validating" | "building" | "launched";
	}

	interface CheckIn {
		avatarUrl?: string | null;
		blocked: string;
		createdAt: string | Date;
		dismissedAt?: string | Date | null;
		founderId: string;
		hasVoted?: boolean;
		help: string | null;
		id: string;
		name: string;
		product: Product | null;
		progress: string;
		voteCount?: number;
	}

	let {
		checkIn,
		showAuthor = true,
		index = 0,
		currentUserId = null,
		onDismissVote,
		isVoting = false,
	}: {
		checkIn: CheckIn;
		showAuthor?: boolean;
		index?: number;
		currentUserId?: string | null;
		onDismissVote?: (checkInId: string) => void;
		isVoting?: boolean;
	} = $props();

	const isDismissed = $derived(!!checkIn.dismissedAt);
	const isOwner = $derived(checkIn.founderId === currentUserId);
	const needsHelp = $derived(Boolean(checkIn.help?.trim()));
	const isEditable = $derived(
		isOwner &&
			!isDismissed &&
			Date.now() - new Date(checkIn.createdAt).getTime() < EDIT_WINDOW_MS
	);
	let confirmOpen = $state(false);
	let editOpen = $state(false);

	const queryClient = useQueryClient();
	const productsQuery = createQuery(() => orpc.products.mine.queryOptions());

	interface CheckInListItem {
		blocked: string;
		help: string | null;
		id: string;
		product: Product | null;
		progress: string;
	}
	interface InfiniteCheckIns {
		pageParams: unknown[];
		pages: { items: CheckInListItem[]; nextCursor?: number }[];
	}
	interface EditorValues {
		blocked: string;
		help: string;
		productId: string;
		progress: string;
	}

	function listKeys() {
		return [orpc.checkIns.listFeed.key(), orpc.checkIns.listByFounder.key()];
	}

	function patchLists(id: string, patch: Partial<CheckInListItem>) {
		for (const queryKey of listKeys()) {
			queryClient.setQueriesData<InfiniteCheckIns>({ queryKey }, (old) =>
				old
					? {
							...old,
							pages: old.pages.map((page) => ({
								...page,
								items: page.items.map((item) =>
									item.id === id ? { ...item, ...patch } : item
								),
							})),
						}
					: old
			);
		}
	}

	function invalidateLists() {
		for (const queryKey of listKeys()) {
			queryClient.invalidateQueries({ queryKey });
		}
	}

	const editMutation = createMutation(() => ({
		...orpc.checkIns.update.mutationOptions(),
		meta: { skipErrorToast: true },
		onError: () => {
			toast.error("Não deu pra salvar o check-in. Tenta de novo.");
			invalidateLists();
		},
		onMutate: (input) => {
			const nextProduct = productsQuery.data?.find(
				(product) => product.id === input.productId
			);
			patchLists(input.id, {
				blocked: input.blocked,
				help: input.help ?? null,
				product: nextProduct ?? checkIn.product,
				progress: input.progress,
			});
		},
	}));

	function saveEdit(value: EditorValues) {
		editOpen = false;
		editMutation.mutate({
			blocked: value.blocked,
			help: value.help || undefined,
			id: checkIn.id,
			productId: value.productId,
			progress: value.progress,
		});
	}

	let editor = $state<{ prime: (v: EditorValues) => void }>();

	function startEditing() {
		editor?.prime({
			blocked: checkIn.blocked,
			help: checkIn.help ?? "",
			productId: checkIn.product?.id ?? "",
			progress: checkIn.progress,
		});
		editOpen = true;
	}
</script>

<motion.div
	animate={{ opacity: isDismissed ? 0.55 : 1, y: 0 }}
	class="rounded-xl border border-border bg-card p-4 {isDismissed
		? 'grayscale-[40%]'
		: ''}"
	initial={{ opacity: 0, y: 6 }}
	transition={{ delay: index * 0.04, duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
>
	{#if isDismissed}
		<div
			class="mb-3 flex items-center gap-1.5 text-xs font-medium text-destructive"
		>
			<FlagIcon class="size-3.5" />
			Desconsiderado pela comunidade
		</div>
	{/if}

	<div class="mb-5 flex items-center justify-between gap-3">
		{#if checkIn.product}
			<ProductChip
				class="max-w-[min(18rem,calc(100vw-8rem))]"
				product={checkIn.product}
				showImage={true}
				showStatus={false}
				variant="tag"
			/>
		{:else}
			<span
				class="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-0.5 pr-2.5 pl-0.5 text-xs font-medium"
			>
				<span
					class="flex size-6 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground"
					>?</span
				>
				Sem produto
			</span>
		{/if}

		{#if needsHelp}
			<Tooltip>
				<TooltipTrigger>
					{#snippet child({ props })}
						<span
							{...props}
							aria-label="Precisa de ajuda"
							class="flex size-6 shrink-0 items-center justify-center"
							role="img"
						>
							<span class="size-2.5 rounded-full bg-destructive"></span>
						</span>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent>Precisa de ajuda</TooltipContent>
			</Tooltip>
		{/if}
	</div>

	<div class="flex flex-col gap-4 text-sm leading-relaxed">
		<section class="border-status-launched/60 border-l-2 pl-3">
			<span class="font-medium text-status-launched text-xs">avançou</span>
			<p class="mt-1 text-foreground">{checkIn.progress}</p>
		</section>
		{#if checkIn.blocked.trim()}
			<section class="border-amber-400/70 border-l-2 pl-3">
				<span class="font-medium text-amber-300 text-xs">travou</span>
				<p class="mt-1 text-foreground">{checkIn.blocked}</p>
			</section>
		{/if}
		{#if checkIn.help?.trim()}
			<section class="border-destructive/70 border-l-2 pl-3">
				<span class="font-medium text-destructive text-xs"
					>precisa de ajuda</span
				>
				<p class="mt-1 text-foreground">{checkIn.help}</p>
			</section>
		{/if}
	</div>

	<div
		class="mt-5 flex items-end justify-between gap-3 border-border/60 border-t pt-3"
	>
		<div class="min-w-0">
			{#if !isOwner && showAuthor}
				<a
					aria-label="Ver perfil de {checkIn.name}"
					class="group flex min-w-0 items-center gap-2"
					href="/profile/{checkIn.founderId}"
				>
					<Avatar name={checkIn.name} size="sm" src={checkIn.avatarUrl} />
					<span class="min-w-0">
						<span
							class="block truncate text-xs font-medium underline decoration-muted-foreground/40 underline-offset-2 transition-colors group-hover:decoration-foreground"
						>
							{checkIn.name}
						</span>
						<span
							class="mt-0.5 block font-mono text-[11px] text-muted-foreground"
						>
							{formatRelative(checkIn.createdAt)}
						</span>
					</span>
				</a>
			{:else}
				<div class="flex min-w-0 items-center gap-2">
					<Avatar name={checkIn.name} size="sm" src={checkIn.avatarUrl} />
					<span class="min-w-0">
						<span class="block truncate text-xs font-medium">
							{isOwner ? "Seu check-in" : checkIn.name}
						</span>
						<span
							class="mt-0.5 block font-mono text-[11px] text-muted-foreground"
						>
							{formatRelative(checkIn.createdAt)}
						</span>
					</span>
				</div>
			{/if}
		</div>

		{#if !isDismissed && ((isOwner && isEditable) || (!isOwner && showAuthor && onDismissVote))}
			<div class="flex items-center gap-1">
				{#if isOwner}
					<Tooltip>
						<TooltipTrigger>
							{#snippet child({ props })}
								<Button
									{...props}
									aria-label="Editar check-in"
									class="text-muted-foreground hover:text-foreground"
									onclick={startEditing}
									size="icon-sm"
									variant="ghost"
								>
									<PencilIcon class="size-3.5" />
								</Button>
							{/snippet}
						</TooltipTrigger>
						<TooltipContent>Editar check-in</TooltipContent>
					</Tooltip>
				{:else if checkIn.hasVoted}
					<Tooltip>
						<TooltipTrigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="flex size-8 items-center justify-center rounded-md text-muted-foreground"
								>
									<FlagIcon class="size-3.5" />
								</span>
							{/snippet}
						</TooltipTrigger>
						<TooltipContent
							>Você votou para desconsiderar ·
							{checkIn.voteCount ?? 0}/5</TooltipContent
						>
					</Tooltip>
				{:else}
					<AlertDialog bind:open={confirmOpen}>
						<Tooltip>
							<TooltipTrigger>
								{#snippet child({ props: tooltipProps })}
									<AlertDialogTrigger>
										{#snippet child({ props: dialogProps })}
											<Button
												{...tooltipProps}
												{...dialogProps}
												aria-label="Desconsiderar check-in"
												class="text-muted-foreground hover:text-destructive"
												disabled={isVoting}
												size="icon-sm"
												variant="ghost"
											>
												<FlagIcon class="size-3.5" />
											</Button>
										{/snippet}
									</AlertDialogTrigger>
								{/snippet}
							</TooltipTrigger>
							<TooltipContent>Desconsiderar check-in</TooltipContent>
						</Tooltip>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle
									>Desconsiderar esse check-in?</AlertDialogTitle
								>
								<AlertDialogDescription>
									Seu voto conta pra decisão da comunidade. Com 5 votos, o
									check-in de {checkIn.name} é marcado como desconsiderado e ela
									perde o streak que ganhou com ele. Essa ação não pode ser
									desfeita depois de confirmada.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancelar</AlertDialogCancel>
								<AlertDialogAction
									onclick={() => onDismissVote?.(checkIn.id)}
									variant="destructive"
								>
									Confirmar voto
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				{/if}
			</div>
		{/if}
	</div>

	{#if isEditable}
		<CheckInEditor
			isSaving={editMutation.isPending}
			onSave={saveEdit}
			products={productsQuery.data ?? []}
			bind:this={editor}
			bind:open={editOpen}
		/>
	{/if}
</motion.div>
