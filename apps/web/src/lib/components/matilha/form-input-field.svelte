<script lang="ts">
	import EyeIcon from "@lucide/svelte/icons/eye";
	import EyeOffIcon from "@lucide/svelte/icons/eye-off";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { Input } from "$lib/components/ui/input/index.js";
	import Field from "./field.svelte";

	interface FormField {
		handleBlur: () => void;
		handleChange: (value: string) => void;
		name: string;
		state: {
			meta: {
				errors: Array<{ message?: string } | undefined>;
				isTouched: boolean;
			};
			value: string;
		};
	}

	let {
		field,
		label,
		placeholder,
		type = "text",
		hint,
		autocomplete,
	}: {
		field: FormField;
		label: string;
		placeholder?: string;
		type?: "email" | "password" | "tel" | "text";
		hint?: string;
		autocomplete?: HTMLInputAttributes["autocomplete"];
	} = $props();

	const hasError = $derived(
		field.state.meta.isTouched && Boolean(field.state.meta.errors[0]?.message)
	);
	const describedBy = $derived.by(() => {
		if (hasError) {
			return `${field.name}-error`;
		}
		return hint ? `${field.name}-hint` : undefined;
	});

	function maskPhoneBR(value: string): string {
		const digits = value.replace(/\D/g, "").slice(0, 11);
		const ddd = digits.slice(0, 2);
		const rest = digits.slice(2);

		if (digits.length <= 2) {
			return digits.length ? `(${ddd}` : "";
		}
		if (digits.length <= 6) {
			return `(${ddd}) ${rest}`;
		}
		if (digits.length <= 10) {
			return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
		}
		return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = type === "tel" ? maskPhoneBR(target.value) : target.value;
		target.value = value;
		field.handleChange(value);
	}

	let showPassword = $state(false);
</script>

<Field
	error={field.state.meta.isTouched ? field.state.meta.errors[0]?.message : undefined}
	{hint}
	htmlFor={field.name}
	{label}
>
	{#if type === "password"}
		<div class="relative">
			<Input
				aria-describedby={describedBy}
				aria-invalid={hasError}
				{autocomplete}
				class="pr-9"
				id={field.name}
				name={field.name}
				onblur={field.handleBlur}
				oninput={handleInput}
				{placeholder}
				type={showPassword ? "text" : "password"}
				value={field.state.value}
			/>
			<button
				aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
				class="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
				onclick={() => {
					showPassword = !showPassword;
				}}
				tabindex={-1}
				type="button"
			>
				{#if showPassword}
					<EyeOffIcon class="size-4" />
				{:else}
					<EyeIcon class="size-4" />
				{/if}
			</button>
		</div>
	{:else}
		<Input
			aria-describedby={describedBy}
			aria-invalid={hasError}
			{autocomplete}
			id={field.name}
			name={field.name}
			onblur={field.handleBlur}
			oninput={handleInput}
			{placeholder}
			{type}
			value={field.state.value}
		/>
	{/if}
</Field>
