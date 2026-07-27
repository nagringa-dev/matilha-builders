<script lang="ts">
	import { MotionConfig, motion } from "@humanspeak/svelte-motion";
	import { QueryClientProvider } from "@tanstack/svelte-query";
	import { SvelteQueryDevtools } from "@tanstack/svelte-query-devtools";
	import { goto, onNavigate } from "$app/navigation";
	import { page } from "$app/state";
	import "../app.css";
	import { authClient } from "$lib/auth-client";
	import { Loader } from "$lib/components/ui/loader/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { queryClient } from "$lib/orpc";
	import AppSidebar from "../components/app-sidebar.svelte";
	import MobileHeader from "../components/mobile-header.svelte";

	const { children } = $props();
	const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
	const isLoginRoute = $derived(publicRoutes.includes(page.url.pathname));
	const sessionQuery = authClient.useSession();
	const approvalStatus = $derived($sessionQuery.data?.user.approvalStatus);
	const isPendingApproval = $derived(
		!!$sessionQuery.data && approvalStatus !== "approved"
	);

	async function handleSignOut() {
		await authClient.signOut({
			fetchOptions: { onSuccess: () => goto("/login") },
		});
	}

	onNavigate((navigation) => {
		if (!document.startViewTransition || document.hidden) {
			return;
		}
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			// Rapid successive navigations (e.g. auth redirect chains) can abort
			// an in-flight transition; that's expected, not an app error.
			transition.ready.catch(() => {});
			transition.finished.catch(() => {});
		});
	});

	$effect(() => {
		if (isLoginRoute || $sessionQuery.isPending) {
			return;
		}
		if (!$sessionQuery.data) {
			goto("/login");
		}
	});

	const isAuthorized = $derived(isLoginRoute || !!$sessionQuery.data);
</script>

<MotionConfig reducedMotion="user">
	<QueryClientProvider client={queryClient}>
		{#if isLoginRoute}
			<main class="h-svh overflow-y-auto">
				{@render children()}
			</main>
		{:else if $sessionQuery.isPending}
			<div class="flex h-svh items-center justify-center">
				<Loader
					size="sm"
					subtitle="Só um instante"
					title="Carregando a matilha..."
				/>
			</div>
		{:else if isAuthorized && isPendingApproval}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				class="flex h-svh flex-col items-center justify-center gap-4 px-4 text-center"
				initial={{ opacity: 0, y: 8 }}
				transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
			>
				<p class="max-w-sm text-sm text-muted-foreground">
					{approvalStatus === "rejected"
					? "Seu cadastro não foi aprovado. Fale com a equipe da matilha."
					: "Sua conta está pendente de aprovação no momento."}
				</p>
				<button
					class="text-sm underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
					onclick={handleSignOut}
					type="button"
				>
					Sair
				</button>
			</motion.div>
		{:else if isAuthorized}
			<Sidebar.Provider class="h-svh">
				<AppSidebar />
				<Sidebar.Inset class="flex flex-col overflow-hidden">
					<MobileHeader />
					<main class="overflow-y-auto">
						{@render children()}
					</main>
				</Sidebar.Inset>
			</Sidebar.Provider>
		{:else}
			<div
				class="flex h-svh items-center justify-center text-sm text-muted-foreground"
			>
				Redirecionando...
			</div>
		{/if}
		<SvelteQueryDevtools />
		<Toaster position="top-center" />
	</QueryClientProvider>
</MotionConfig>
