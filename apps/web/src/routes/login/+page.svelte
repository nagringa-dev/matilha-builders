<script lang="ts">
	import SignInForm from "../../components/sign-in-form.svelte";
	import SignUpForm from "../../components/sign-up-form.svelte";

	let showSignIn = $state(true);
</script>

{#if showSignIn}
	<SignInForm
		switchToSignUp={() => {
			showSignIn = false;
		}}
	/>
{:else}
	<SignUpForm
		switchToSignIn={() => {
			showSignIn = true;
		}}
	/>
{/if}
