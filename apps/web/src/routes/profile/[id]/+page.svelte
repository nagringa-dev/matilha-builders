<script lang="ts">
	import { createForm } from "@tanstack/svelte-form";
	import {
		createInfiniteQuery,
		createMutation,
		createQuery,
		useQueryClient,
	} from "@tanstack/svelte-query";
	import { z } from "zod";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth-client";
	import FormInputField from "$lib/components/matilha/form-input-field.svelte";
	import FormTextareaField from "$lib/components/matilha/form-textarea-field.svelte";
	import ProfileCheckInHistory from "$lib/components/matilha/profile-check-in-history.svelte";
	import ProfileHeader from "$lib/components/matilha/profile-header.svelte";
	import ProfileProducts from "$lib/components/matilha/profile-products.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Drawer,
		DrawerClose,
		DrawerContent,
		DrawerFooter,
		DrawerHeader,
		DrawerTitle,
	} from "$lib/components/ui/drawer/index.js";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { toast } from "$lib/components/ui/sonner/index.js";
	import { orpc } from "$lib/orpc";

	const founderId = $derived(page.params.id ?? "");
	const sessionQuery = authClient.useSession();
	const isOwnProfile = $derived($sessionQuery.data?.user.id === founderId);
	const founderQuery = createQuery(() =>
		orpc.founders.get.queryOptions({ input: { founderId } })
	);
	const historyQuery = createInfiniteQuery(() =>
		orpc.checkIns.listByFounder.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
			input: (cursor: number) => ({ cursor, founderId }),
		})
	);
	const history = $derived(
		historyQuery.data?.pages.flatMap((historyPage) => historyPage.items) ?? []
	);

	type FounderData = NonNullable<typeof founderQuery.data>;
	type SubmitState = Pick<
		typeof profileForm.state,
		"canSubmit" | "isSubmitting"
	>;

	const queryClient = useQueryClient();
	let avatarPreview = $state<string | null>(null);
	let checkInsOpen = $state(true);
	let showEditProfile = $state(false);

	function founderQueryKey() {
		return orpc.founders.get.queryOptions({ input: { founderId } }).queryKey;
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

	function refetchFounder() {
		settleOtherCaches();
		return founderQuery.refetch();
	}

	function updateAvatarPreview(url: string | null) {
		avatarPreview = url;
	}

	const profileSchema = z.object({
		bio: z.string(),
		name: z.string().min(1, "Nome é obrigatório"),
	});

	const updateBio = createMutation(() => ({
		...orpc.founders.updateBio.mutationOptions(),
		meta: { skipErrorToast: true },
		onError: (
			_error,
			_input,
			context: { snapshot: FounderData | undefined } | undefined
		) => {
			restoreFounder(context?.snapshot);
		},
		onMutate: async (input) => {
			const snapshot = await snapshotAndCancelFounder();
			patchFounder((data) => ({ ...data, bio: input.bio || null }));
			return { snapshot };
		},
		onSettled: settleOtherCaches,
	}));

	const profileForm = createForm(() => ({
		defaultValues: { bio: "", name: "" },
		onSubmit: async ({ value }) => {
			const snapshot = await snapshotAndCancelFounder();
			patchFounder((data) => ({
				...data,
				bio: value.bio || null,
				name: value.name,
			}));
			showEditProfile = false;
			try {
				await authClient.updateUser({ name: value.name });
				await updateBio.mutateAsync({ bio: value.bio });
			} catch (error) {
				restoreFounder(snapshot);
				showEditProfile = true;
				console.error(error);
				toast.error("Não deu pra salvar o perfil. Tenta de novo.");
			}
		},
		validators: { onSubmit: profileSchema },
	}));

	function openEditProfile(name: string, bio: string | null) {
		profileForm.reset({ bio: bio ?? "", name });
		showEditProfile = true;
	}
</script>

{#if founderQuery.isLoading}
	<div class="px-4 py-6 md:px-6">
		<Loader size="sm" subtitle="Buscando o perfil" title="Carregando..." />
	</div>
{:else if founderQuery.data}
	{@const founder = founderQuery.data as FounderData}
	<div class="px-4 py-6 md:px-6">
		<ProfileHeader
			{avatarPreview}
			{founder}
			{isOwnProfile}
			onAvatarPreview={updateAvatarPreview}
			onAvatarUploaded={refetchFounder}
			onEdit={() => openEditProfile(founder.name, founder.bio)}
		/>

		{#if isOwnProfile}
			<Drawer bind:open={showEditProfile}>
				<DrawerContent>
					<div class="mx-auto w-full max-w-md">
						<DrawerHeader>
							<DrawerTitle>Editar perfil</DrawerTitle>
						</DrawerHeader>
						<form
							class="flex flex-col gap-4 px-4 pb-2"
							onsubmit={(event) => {
								event.preventDefault();
								event.stopPropagation();
								profileForm.handleSubmit();
							}}
						>
							<profileForm.Field name="name">
								{#snippet children(field)}
									<FormInputField {field} label="Nome" />
								{/snippet}
							</profileForm.Field>
							<profileForm.Field name="bio">
								{#snippet children(field)}
									<FormTextareaField
										{field}
										hint="opcional"
										label="Bio"
										placeholder="Conta rapidinho quem você é"
										rows={3}
										showError={false}
									/>
								{/snippet}
							</profileForm.Field>
							<profileForm.Subscribe
								selector={(state: typeof profileForm.state): SubmitState => ({
									canSubmit: state.canSubmit,
									isSubmitting: state.isSubmitting,
								})}
							>
								{#snippet children(state: SubmitState)}
									<Button
										disabled={!state.canSubmit || state.isSubmitting}
										type="submit"
									>
										{state.isSubmitting ? "Salvando..." : "Salvar"}
									</Button>
								{/snippet}
							</profileForm.Subscribe>
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
		{/if}

		<ProfileProducts {founderId} {isOwnProfile} />
		<Separator class="mb-6" />
		<ProfileCheckInHistory
			currentUserId={$sessionQuery.data?.user.id ?? null}
			founderName={founder.name}
			hasNextPage={historyQuery.hasNextPage}
			{history}
			isFetchingNextPage={historyQuery.isFetchingNextPage}
			onLoadMore={() => historyQuery.fetchNextPage()}
			bind:open={checkInsOpen}
		/>
	</div>
{/if}
