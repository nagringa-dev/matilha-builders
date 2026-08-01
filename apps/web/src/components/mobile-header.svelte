<script lang="ts">
	import PawPrintIcon from "@lucide/svelte/icons/paw-print";
	import { SidebarTrigger } from "$lib/components/ui/sidebar/index.js";
	import UserMenu from "./user-menu.svelte";
</script>

<div
	class="sticky top-0 z-10 flex items-center justify-between border-border/60 border-b bg-background/85 px-4 py-3 backdrop-blur-md md:hidden"
>
	<div class="flex items-center gap-3">
		<SidebarTrigger />
		<a
			class="flex items-center gap-1.5 font-mono text-[15px] font-bold"
			href="/board"
		>
			<PawPrintIcon class="size-4 text-streak" fill="currentColor" />
			<span>matilha_builders</span>
		</a>
	</div>
	<UserMenu />
</div>
