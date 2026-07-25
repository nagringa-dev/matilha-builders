<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import { formatPhone } from "@matilha-builders/api/lib/phone";
	import {
		createInfiniteQuery,
		createMutation,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { goto } from "$app/navigation";
	import { authClient } from "$lib/auth-client";
	import InfiniteScrollSentinel from "$lib/components/matilha/infinite-scroll-sentinel.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { orpc } from "$lib/orpc";

	const interestLabels: Record<string, string> = {
		building: "Construindo/idealizando",
		observing: "Só observando",
		running: "Já tenho produto rodando",
	};

	const sessionQuery = authClient.useSession();
	const isSuperAdmin = $derived(
		$sessionQuery.data?.user.role === "super_admin"
	);

	$effect(() => {
		if (!($sessionQuery.isPending || isSuperAdmin)) {
			goto("/board");
		}
	});

	const queryClient = useQueryClient();
	const pendingQuery = createInfiniteQuery(() => ({
		...orpc.admin.listPendingUsers.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor }),
		}),
		enabled: isSuperAdmin,
	}));

	const pendingUsers = $derived(
		pendingQuery.data?.pages.flatMap((page) => page.items) ?? []
	);

	type PendingItem = NonNullable<
		typeof pendingQuery.data
	>["pages"][number]["items"][number];
	type PendingData = NonNullable<typeof pendingQuery.data>;

	function pendingQueryKey() {
		return orpc.admin.listPendingUsers.infiniteKey({
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor }),
		});
	}

	async function removeOptimistically(userId: string) {
		await queryClient.cancelQueries({ queryKey: pendingQueryKey() });
		const snapshot = queryClient.getQueryData<PendingData>(pendingQueryKey());
		queryClient.setQueryData<PendingData>(pendingQueryKey(), (old) =>
			old
				? {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							items: page.items.filter((u: PendingItem) => u.userId !== userId),
						})),
					}
				: old
		);
		return { snapshot };
	}

	function restorePending(snapshot: PendingData | undefined) {
		if (snapshot) {
			queryClient.setQueryData(pendingQueryKey(), snapshot);
		}
	}

	// No onSettled invalidate here: the optimistic removal already matches
	// what a fresh fetch would return, so refetching the same list that's
	// on screen would just race the optimistic update and flicker.
	const approveUser = createMutation(() => ({
		...orpc.admin.approveUser.mutationOptions(),
		onError: (
			_error,
			_input,
			context: { snapshot: PendingData | undefined } | undefined
		) => {
			restorePending(context?.snapshot);
		},
		onMutate: (input) => removeOptimistically(input.userId),
	}));

	const rejectUser = createMutation(() => ({
		...orpc.admin.rejectUser.mutationOptions(),
		onError: (
			_error,
			_input,
			context: { snapshot: PendingData | undefined } | undefined
		) => {
			restorePending(context?.snapshot);
		},
		onMutate: (input) => removeOptimistically(input.userId),
	}));
</script>

<div class="px-4 py-8 md:px-6">
	<div class="mb-6 border-border border-b pb-5">
		<h1 class="text-2xl font-bold tracking-tight">Solicitações</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Contas aguardando aprovação para entrar na matilha
		</p>
	</div>
	{#if pendingQuery.isLoading}
		<Loader size="sm" subtitle="Buscando solicitações" title="Carregando..." />
	{:else if !pendingUsers.length}
		<p class="text-sm text-muted-foreground">
			Nenhuma solicitação pendente no momento.
		</p>
	{:else}
		<div class="flex flex-col gap-3">
			<AnimatePresence>
				{#each pendingUsers as request, index (request.userId)}
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
						exit={{ opacity: 0, scale: 0.97 }}
						initial={{ opacity: 0, y: 8 }}
						key={request.userId}
						transition={{
							delay: index * 0.04,
							duration: 0.2,
							ease: [0.23, 1, 0.32, 1],
						}}
					>
						<div class="flex flex-col gap-0.5">
							<span class="text-sm font-semibold">{request.name}</span>
							<span class="text-xs text-muted-foreground">{request.email}</span>
							{#if request.phone}
								<span class="text-xs text-muted-foreground"
									>{formatPhone(request.phone)}</span
								>
							{/if}
							{#if request.interest}
								<span class="mt-1 text-xs text-streak"
									>{interestLabels[request.interest]}</span
								>
							{/if}
						</div>
						<div class="flex gap-2">
							<Button
								disabled={rejectUser.isPending}
								onclick={() => rejectUser.mutate({ userId: request.userId })}
								size="sm"
								variant="outline"
							>
								Recusar
							</Button>
							<Button
								disabled={approveUser.isPending}
								onclick={() => approveUser.mutate({ userId: request.userId })}
								size="sm"
							>
								Aprovar
							</Button>
						</div>
					</motion.div>
				{/each}
			</AnimatePresence>
		</div>
		<InfiniteScrollSentinel
			hasNextPage={pendingQuery.hasNextPage}
			isFetchingNextPage={pendingQuery.isFetchingNextPage}
			onLoadMore={() => pendingQuery.fetchNextPage()}
		/>
	{/if}
</div>
