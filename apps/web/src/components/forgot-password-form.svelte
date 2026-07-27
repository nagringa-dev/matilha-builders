<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import PawPrintIcon from "@lucide/svelte/icons/paw-print";
	import { createForm } from "@tanstack/svelte-form";
	import { z } from "zod";
	import { authClient } from "$lib/auth-client";
	import FormInputField from "$lib/components/matilha/form-input-field.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Card } from "$lib/components/ui/card/index.js";

	let errorMessage = $state("");
	let sent = $state(false);

	const validationSchema = z.object({
		email: z.email("Email inválido"),
	});

	const form = createForm(() => ({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			errorMessage = "";
			await authClient.requestPasswordReset(
				{
					email: value.email,
					redirectTo: "/reset-password",
				},
				{
					onError: (error) => {
						errorMessage =
							error.error.message ?? "Não deu pra enviar. Tenta de novo.";
					},
					onSuccess: () => {
						sent = true;
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
			Esqueceu sua senha? Sem crise.
		</p>
	</div>
	<Card class="border border-border p-4">
		{#if sent}
			<div class="flex flex-col items-center gap-2 py-4 text-center">
				<p class="text-sm text-foreground">
					Se esse email existir na nossa base, o link de redefinição já foi
					gerado.
				</p>
				<p class="text-sm text-muted-foreground">
					Peça pra equipe te passar o link de redefinição.
				</p>
			</div>
		{:else}
			<form
				class="flex flex-col gap-4"
				onsubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<AnimatePresence>
					{#if errorMessage}
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

				<form.Subscribe
					selector={(state: typeof form.state): SubmitState => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
				>
					{#snippet children(state: SubmitState)}
						<Button
							class="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{state.isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
						</Button>
					{/snippet}
				</form.Subscribe>
			</form>
		{/if}
	</Card>
	<p class="mt-4 text-center text-sm text-muted-foreground">
		<a
			class="text-foreground transition-colors hover:text-muted-foreground"
			href="/login"
		>
			Voltar para o login
		</a>
	</p>
</motion.div>
