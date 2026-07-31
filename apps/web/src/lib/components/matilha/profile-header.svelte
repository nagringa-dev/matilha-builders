<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import Avatar from "./avatar.svelte";
	import ImageUploadButton from "./image-upload-button.svelte";
	import StreakBadge from "./streak-badge.svelte";

	interface Founder {
		avatarUrl: string | null;
		bio: string | null;
		name: string;
		streak: number;
	}

	let {
		founder,
		isOwnProfile,
		avatarPreview,
		onAvatarPreview,
		onAvatarUploaded,
		onEdit,
	}: {
		founder: Founder;
		isOwnProfile: boolean;
		avatarPreview: string | null;
		onAvatarPreview: (url: string | null) => void;
		onAvatarUploaded: () => Promise<unknown>;
		onEdit: () => void;
	} = $props();

	let bioElement = $state<HTMLParagraphElement>();
	let bioExpanded = $state(false);
	let bioOverflows = $state(false);

	function toggleBio() {
		bioExpanded = !bioExpanded;
	}

	/** Only measurable while clamped — expanding removes the overflow it detects. */
	$effect(() => {
		const element = bioElement;
		const { bio } = founder;
		if (!(element && bio) || bioExpanded) {
			return;
		}
		const measure = () => {
			bioOverflows = element.scrollHeight > element.clientHeight + 1;
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});
</script>

<div class="mb-6">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-start gap-3">
			{#if isOwnProfile}
				<ImageUploadButton
					endpoint="avatarUploader"
					label="Trocar foto de perfil"
					onPreview={onAvatarPreview}
					onUploaded={onAvatarUploaded}
					overlay
				>
					{#snippet children()}
						<Avatar
							name={founder.name}
							size="lg"
							src={avatarPreview ?? founder.avatarUrl}
						/>
					{/snippet}
				</ImageUploadButton>
			{:else}
				<Avatar name={founder.name} size="lg" src={founder.avatarUrl} />
			{/if}
			<div>
				<h1 class="text-2xl font-bold">{founder.name}</h1>
				<p class="mt-0.5 text-sm text-muted-foreground">
					{#if founder.streak < 0}
						streak em atraso: {founder.streak}
						{founder.streak === -1 ? "semana" : "semanas"}
					{:else}
						construindo há {founder.streak}
						{founder.streak === 1 ? "semana seguida" : "semanas seguidas"}
					{/if}
				</p>
			</div>
		</div>
		<StreakBadge weeks={founder.streak} />
	</div>

	{#if founder.bio}
		<p
			class="mt-3 whitespace-pre-line text-sm leading-relaxed {bioExpanded
				? ''
				: 'line-clamp-3'}"
			bind:this={bioElement}
		>
			{founder.bio}
		</p>
		{#if bioOverflows}
			<button
				class="mt-1 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
				onclick={toggleBio}
				type="button"
			>
				{bioExpanded ? "ver menos" : "ver mais"}
			</button>
		{/if}
	{/if}

	{#if isOwnProfile}
		<div class="mt-3">
			<Button onclick={onEdit} size="sm" variant="outline"
				>Editar perfil</Button
			>
		</div>
	{/if}
</div>
