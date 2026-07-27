<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import PawPrintIcon from "@lucide/svelte/icons/paw-print";
	import { createForm } from "@tanstack/svelte-form";
	import { z } from "zod";
	import { goto } from "$app/navigation";
	import { authClient } from "$lib/auth-client";
	import FormInputField from "$lib/components/matilha/form-input-field.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Card } from "$lib/components/ui/card/index.js";

	let { switchToSignUp } = $props<{ switchToSignUp: () => void }>();

	let pendingMessage = $state("");
	let errorMessage = $state("");

	const validationSchema = z.object({
		email: z.email("Email inválido"),
		password: z.string().min(1, "Senha é obrigatória"),
	});

	const errorMessages: Record<string, string> = {
		INVALID_EMAIL_OR_PASSWORD: "Email ou senha incorretos.",
	};

	const form = createForm(() => ({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			pendingMessage = "";
			errorMessage = "";
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
				{
					onError: (error) => {
						errorMessage =
							errorMessages[error.error.code ?? ""] ??
							error.error.message ??
							"Não deu pra entrar. Tenta de novo.";
					},
					onSuccess: async () => {
						const { data } = await authClient.getSession();
						if (data?.user && data.user.approvalStatus !== "approved") {
							await authClient.signOut();
							pendingMessage =
								data.user.approvalStatus === "rejected"
									? "Seu cadastro não foi aprovado. Fale com a equipe da matilha."
									: "Sua conta está pendente de aprovação no momento.";
							return;
						}
						goto("/board");
					},
				}
			);
		},
		validators: {
			onSubmit: validationSchema,
		},
	}));

	type SubmitState = Pick<typeof form.state, "canSubmit" | "isSubmitting">;
</script>

<motion.div
	animate={{ opacity: 1, y: 0 }}
	class="mx-auto w-full max-w-[400px] px-4 py-16"
	initial={{ opacity: 0, y: 10 }}
	transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
>
	<div class="mb-6 text-center">
		<h1
			class="flex items-center justify-center gap-1.5 font-mono text-2xl font-bold"
		>
			<PawPrintIcon class="size-4 text-streak" fill="currentColor" />
			<span>matilha_builders</span>
		</h1>
		<p class="mt-1.5 text-sm text-muted-foreground">
			Só pra quem tá na matilha.
		</p>
	</div>
	<Card class="border border-border p-4">
		<form
			class="flex flex-col gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<AnimatePresence>
				{#if pendingMessage}
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						class="rounded-md border border-status-validating/30 bg-status-validating/10 px-3 py-2 text-sm text-status-validating"
						exit={{ opacity: 0, y: -6 }}
						initial={{ opacity: 0, y: -6 }}
						key="pending-message"
						role="alert"
						transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
					>
						{pendingMessage}
					</motion.div>
				{:else if errorMessage}
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						exit={{ opacity: 0, y: -6 }}
						initial={{ opacity: 0, y: -6 }}
						key="error-message"
						role="alert"
						transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
					>
						{errorMessage}
					</motion.div>
				{/if}
			</AnimatePresence>

			<form.Field name="email">
				{#snippet children(field)}
					<FormInputField
						autocomplete="username"
						{field}
						label="Email"
						placeholder="seu@email.com"
						type="email"
					/>
				{/snippet}
			</form.Field>

			<form.Field name="password">
				{#snippet children(field)}
					<FormInputField
						autocomplete="current-password"
						{field}
						label="Senha"
						placeholder="••••••••"
						type="password"
					/>
				{/snippet}
			</form.Field>

			<a
				class="-mt-2 text-right text-sm text-muted-foreground transition-colors hover:text-foreground"
				href="/forgot-password"
			>
				Esqueci minha senha
			</a>

			<form.Subscribe
				selector={(state: typeof form.state): SubmitState => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
			>
				{#snippet children(state: SubmitState)}
					<Button
						class="w-full"
						disabled={!state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{state.isSubmitting ? "Entrando..." : "Entrar"}
					</Button>
				{/snippet}
			</form.Subscribe>
		</form>
	</Card>
	<p class="mt-4 text-center text-sm text-muted-foreground">
		Ainda não tem conta?
		<button
			class="text-foreground transition-colors hover:text-muted-foreground"
			onclick={switchToSignUp}
			type="button"
		>
			Criar conta
		</button>
	</p>
</motion.div>
