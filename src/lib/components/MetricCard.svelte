<script lang="ts">
	import Tooltip from './Tooltip.svelte';

	export let label = '';
	export let value = '';
	export let detail = '';
	export let tone: 'default' | 'success' | 'warning' | 'danger' = 'default';
	export let hint = '';
</script>

<article class={`metric ${tone}`}>
	<div class="head">
		<p>{label}</p>
		{#if hint}
			<Tooltip content={hint} label={`Info sobre ${label}`} />
		{/if}
	</div>
	<h3>{value}</h3>
	<span>{detail}</span>
</article>

<style>
	.metric {
		padding: 1rem 1.05rem;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		display: grid;
		gap: 0.35rem;
		box-shadow: var(--shadow-md);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}

	p {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	h3 {
		margin: 0;
		font-size: clamp(1.3rem, 3vw, 2rem);
		line-height: 1;
	}

	span {
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.success {
		border-color: rgba(35, 133, 109, 0.28);
		box-shadow: inset 0 0 0 1px rgba(35, 133, 109, 0.08);
	}

	.warning {
		border-color: rgba(242, 191, 79, 0.3);
		box-shadow: inset 0 0 0 1px rgba(242, 191, 79, 0.08);
	}

	.danger {
		border-color: rgba(208, 87, 107, 0.28);
		box-shadow: inset 0 0 0 1px rgba(208, 87, 107, 0.08);
	}
</style>
