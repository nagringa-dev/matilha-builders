<script lang="ts">
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible/index.js";
	import FormTextareaField from "./form-textarea-field.svelte";

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
		enabled = false,
		field,
		label,
		onEnabledChange,
		placeholder,
		tone = "warning",
	}: {
		enabled?: boolean;
		field: FormField;
		label: string;
		onEnabledChange: (enabled: boolean) => void;
		placeholder: string;
		tone?: "danger" | "warning";
	} = $props();
</script>

<Collapsible onOpenChange={onEnabledChange} open={enabled}>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
	>
		<span>{label}</span>
		<ChevronDownIcon
			class="size-4 text-muted-foreground transition-transform duration-200 {enabled
				? 'rotate-180'
				: ''}"
		/>
	</CollapsibleTrigger>
	<CollapsibleContent
		class="overflow-hidden duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
	>
		<div class="pt-2">
			<FormTextareaField
				{field}
				hideLabel
				label={tone === "danger" ? "Como a comunidade pode ajudar?" : "O que te travou?"}
				{placeholder}
				rows={2}
			/>
		</div>
	</CollapsibleContent>
</Collapsible>
