<script lang="ts">
	import { AnimatePresence, motion } from "@humanspeak/svelte-motion";
	import PawPrintIcon from "@lucide/svelte/icons/paw-print";
	import { createForm } from "@tanstack/svelte-form";
	import { z } from "zod";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth-client";
	import FormInputField from "$lib/components/matilha/form-input-field.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Card } from "$lib/components/ui/card/index.js";

	const token = $derived(page.url.searchParams.get("token") ?? "");

	let errorMessage = $state("");
	let success = $state(false);

	const validationSchema = z
		.object({
			confirmPassword: z.string().min(1, "Confirme a senha"),
			password: z.string().min(8, "Mínimo de 8 caracteres"),
		})
		.refine((value) => value.password === value.confirmPassword, {
			message: "As senhas não coincidem",
			path: ["confirmPassword"],
		});

	const form = createForm(() => ({
		defaultValues: { confirmPassword: "", password: "" },
		onSubmit: async ({ value }) => {
			errorMessage = "";
			if (!token) {
				errorMessage = "Link inválido ou expirado.";
				return;
			}
			await authClient.resetPassword(
				{ newPassword: value.password, token },
				{
					onError: (error) => {
						errorMessage =
							error.error.message ?? "Não deu pra redefinir. Tenta de novo.";
					},
					onSuccess: () => {
						success = true;
						setTimeout(() => goto("/login"), 2000);
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
		<p class="mt-1.5 text-sm text-muted-foreground">Crie uma nova senha.</p>
	</div>
	<Card class="border border-border p-4">
		{#if !token}
			<p class="py-4 text-center text-sm text-destructive">
				Link inválido ou expirado. Peça um novo link em "Esqueci minha senha".
			</p>
		{:else if success}
			<p class="py-4 text-center text-sm text-foreground">
				Senha redefinida! Redirecionando pro login...
			</p>
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

				<form.Field name="password">
					{#snippet children(field)}
						<FormInputField
							autocomplete="new-password"
							{field}
							label="Nova senha"
							placeholder="••••••••"
							type="password"
						/>
					{/snippet}
				</form.Field>

				<form.Field name="confirmPassword">
					{#snippet children(field)}
						<FormInputField
							autocomplete="new-password"
							{field}
							label="Confirme a nova senha"
							placeholder="••••••••"
							type="password"
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
							{state.isSubmitting ? "Salvando..." : "Redefinir senha"}
						</Button>
					{/snippet}
				</form.Subscribe>
			</form>
		{/if}
	</Card>
</motion.div>
