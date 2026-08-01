<script lang="ts">
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import UserIcon from "@lucide/svelte/icons/user";
	import { createQuery } from "@tanstack/svelte-query";
	import { goto } from "$app/navigation";
	import { authClient } from "$lib/auth-client";
	import Avatar from "$lib/components/matilha/avatar.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Popover,
		PopoverContent,
		PopoverTrigger,
	} from "$lib/components/ui/popover/index.js";
	import {
		SidebarMenu,
		SidebarMenuButton,
		SidebarMenuItem,
	} from "$lib/components/ui/sidebar/index.js";
	import { toast } from "$lib/components/ui/sonner/index.js";
	import { orpc } from "$lib/orpc";

	let { variant = "compact" }: { variant?: "compact" | "full" } = $props();

	const sessionQuery = authClient.useSession();
	const currentUserId = $derived($sessionQuery.data?.user.id ?? "");
	const founderQuery = createQuery(() => ({
		...orpc.founders.get.queryOptions({ input: { founderId: currentUserId } }),
		enabled: !!currentUserId,
	}));

	let popoverOpen = $state(false);

	async function handleSignOut() {
		popoverOpen = false;
		await authClient.signOut({
			fetchOptions: {
				onError: (error) => {
					console.error("Sign out failed:", error);
					toast.error("Não deu pra sair. Tenta de novo.");
				},
				onSuccess: () => goto("/login"),
			},
		});
	}
</script>

{#if $sessionQuery.isPending}
	<div class="size-7 animate-pulse rounded-full bg-secondary"></div>
{:else if $sessionQuery.data?.user}
	{@const currentUser = $sessionQuery.data.user}
	<Popover bind:open={popoverOpen}>
		{#if variant === "full"}
			<SidebarMenu>
				<SidebarMenuItem>
					<PopoverTrigger class="w-full">
						{#snippet child({ props })}
							<SidebarMenuButton size="lg" {...props}>
								<Avatar
									name={currentUser.name || currentUser.email || "?"}
									src={founderQuery.data?.avatarUrl}
								/>
								<div
									class="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
								>
									<span class="truncate font-semibold">{currentUser.name}</span>
									<span class="truncate text-xs text-muted-foreground">
										{currentUser.email}
									</span>
								</div>
								<ChevronsUpDownIcon
									class="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden"
								/>
							</SidebarMenuButton>
						{/snippet}
					</PopoverTrigger>
				</SidebarMenuItem>
			</SidebarMenu>
		{:else}
			<PopoverTrigger
				class="flex size-7 items-center justify-center rounded-full p-0"
			>
				<Avatar
					name={currentUser.name || currentUser.email || "?"}
					src={founderQuery.data?.avatarUrl}
				/>
			</PopoverTrigger>
		{/if}
		<PopoverContent align="end" class="w-44 gap-1 p-1">
			<a
				class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
				href={`/profile/${currentUser.id}`}
				onclick={() => {
					popoverOpen = false;
				}}
			>
				<UserIcon class="size-4" />
				Perfil
			</a>
			<button
				class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive text-sm transition-colors hover:bg-destructive/10"
				onclick={handleSignOut}
				type="button"
			>
				<LogOutIcon class="size-4" />
				Sair
			</button>
		</PopoverContent>
	</Popover>
{:else}
	<Button href="/login" size="sm">Entrar</Button>
{/if}
