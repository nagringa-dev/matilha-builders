<script lang="ts">
	import CalendarCheckIcon from "@lucide/svelte/icons/calendar-check";
	import InboxIcon from "@lucide/svelte/icons/inbox";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import PawPrintIcon from "@lucide/svelte/icons/paw-print";
	import RssIcon from "@lucide/svelte/icons/rss";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth-client";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import UserMenu from "./user-menu.svelte";

	const sessionQuery = authClient.useSession();
	const isSuperAdmin = $derived(
		$sessionQuery.data?.user.role === "super_admin"
	);

	const baseLinks = [
		{ href: "/board", icon: LayoutDashboardIcon, label: "Board" },
		{ href: "/feed", icon: RssIcon, label: "Feed" },
		{ href: "/checkin", icon: CalendarCheckIcon, label: "Check-in" },
	];
	const links = $derived(
		isSuperAdmin
			? [
					...baseLinks,
					{ href: "/requests", icon: InboxIcon, label: "Solicitações" },
				]
			: baseLinks
	);
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header class="pb-4">
		<div
			class="flex items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-3"
		>
			<Sidebar.Menu
				class="w-auto flex-1 group-data-[collapsible=icon]:flex-none"
			>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg">
						{#snippet child({ props })}
							<a
								{...props}
								class="flex items-center justify-start gap-1.5 font-mono text-[15px] font-bold group-data-[collapsible=icon]:justify-center"
								href="/board"
							>
								<PawPrintIcon
									class="size-4 shrink-0 text-streak"
									fill="currentColor"
								/>
								<span class="group-data-[collapsible=icon]:hidden">
									matilha_builders
								</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
			<Sidebar.Trigger class="shrink-0" />
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each links as link (link.href)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={page.url.pathname === link.href}
							tooltipContent={link.label}
						>
							{#snippet child({ props })}
								<a {...props} href={link.href}>
									<link.icon class="size-4 shrink-0" />
									<span>{link.label}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<UserMenu variant="full" />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
