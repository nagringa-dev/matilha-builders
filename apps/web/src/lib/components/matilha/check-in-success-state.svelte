<script lang="ts">
	import { motion } from "@humanspeak/svelte-motion";
	import { Button } from "$lib/components/ui/button/index.js";

	let { streak }: { streak: number } = $props();
</script>

<div class="mx-auto max-w-2xl px-4 py-12 md:px-6">
	<motion.div
		animate={{ opacity: 1, scale: 1 }}
		class="text-center"
		initial={{ opacity: 0, scale: 0.94 }}
		transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
	>
		<motion.div
			animate={{ opacity: 1, scale: 1 }}
			class="font-mono text-[28px] font-bold text-streak"
			initial={{ opacity: 0, scale: 0.8 }}
			transition={{ bounce: 0.35, delay: 0.1, duration: 0.4, type: "spring" }}
		>
			{streak} {streak === 1 ? "semana" : "semanas"}
		</motion.div>
		<p class="mt-1 text-sm text-muted-foreground">
			Check-in postado. Streak mantido.
		</p>
		<Button class="mt-4" href="/feed" variant="outline">Ver o feed</Button>
	</motion.div>
</div>
