<script lang="ts">
	export let label = '';
	export let value = '';
	export let detail = '';
	export let tone: 'default' | 'success' | 'warning' | 'danger' = 'default';
</script>

<article class={`metric ${tone}`}>
	<p>{label}</p>
	<h3>{value}</h3>
	<span>{detail}</span>
</article>

<style>
	.metric {
		padding: 1rem 1.05rem;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.04);
		display: grid;
		gap: 0.35rem;
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
		border-color: rgba(132, 204, 22, 0.28);
		box-shadow: inset 0 0 0 1px rgba(132, 204, 22, 0.08);
	}

	.warning {
		border-color: rgba(255, 138, 61, 0.3);
		box-shadow: inset 0 0 0 1px rgba(255, 138, 61, 0.08);
	}

	.danger {
		border-color: rgba(251, 113, 133, 0.28);
		box-shadow: inset 0 0 0 1px rgba(251, 113, 133, 0.08);
	}
</style>
