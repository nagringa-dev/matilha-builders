<script lang="ts">
	import { Textarea } from "$lib/components/ui/textarea/index.js";
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
		rows,
		hint,
		showError = true,
	}: {
		field: FormField;
		label: string;
		placeholder: string;
		rows: number;
		hint?: string;
		showError?: boolean;
	} = $props();

	const hasError = $derived(
		showError &&
			field.state.meta.isTouched &&
			Boolean(field.state.meta.errors[0]?.message)
	);
	const describedBy = $derived.by(() => {
		if (hasError) {
			return `${field.name}-error`;
		}
		return hint ? `${field.name}-hint` : undefined;
	});
</script>

<Field
	error={hasError ? field.state.meta.errors[0]?.message : undefined}
	{hint}
	htmlFor={field.name}
	{label}
>
	<Textarea
		aria-describedby={describedBy}
		aria-invalid={hasError}
		id={field.name}
		name={field.name}
		onblur={field.handleBlur}
		oninput={(event: Event) => field.handleChange((event.target as HTMLTextAreaElement).value)}
		{placeholder}
		{rows}
		value={field.state.value}
	/>
</Field>
