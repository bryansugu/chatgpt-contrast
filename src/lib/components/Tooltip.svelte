<script lang="ts">
	export let content = '';
	export let label = 'Más información';
</script>

<span class="tooltip">
	<button type="button" class="trigger" aria-label={label}>
		i
	</button>
	<span class="bubble" role="tooltip">{content}</span>
</span>

<style>
	.tooltip {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.trigger {
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--surface-3);
		color: var(--ink-soft);
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
		padding: 0;
		box-shadow: var(--shadow-md);
	}

	.trigger:hover,
	.trigger:focus-visible {
		color: var(--accent);
		border-color: var(--accent);
		outline: none;
	}

	.bubble {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 0.65rem);
		transform: translateX(-50%) translateY(4px);
		width: min(18rem, 72vw);
		padding: 0.7rem 0.8rem;
		border-radius: 14px;
		border: 1px solid var(--line-strong);
		background: var(--surface-2);
		color: var(--ink-strong);
		font-size: 0.8rem;
		line-height: 1.55;
		box-shadow: var(--shadow-lg);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 160ms ease,
			transform 160ms ease;
		z-index: 30;
	}

	.tooltip:hover .bubble,
	.trigger:focus-visible + .bubble {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
</style>
