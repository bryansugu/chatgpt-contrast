<script lang="ts">
	export let eyebrow = '';
	export let title = '';
	export let description = '';
</script>

<section class="section-card">
	<header class="section-head">
		<div>
			{#if eyebrow}
				<p class="eyebrow">{eyebrow}</p>
			{/if}
			{#if title}
				<h2>{title}</h2>
			{/if}
			{#if description}
				<p class="description">{description}</p>
			{/if}
		</div>
		<div class="actions">
			<slot name="actions" />
		</div>
	</header>

	<div class="content">
		<slot />
	</div>
</section>

<style>
	.section-card {
		position: relative;
		border: 1px solid var(--line);
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 24%),
			var(--surface-1);
		backdrop-filter: blur(22px);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.section-card::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(120deg, rgba(255, 255, 255, 0.09), transparent 34%, transparent);
		opacity: 0.55;
	}

	.section-head,
	.content {
		position: relative;
		z-index: 1;
	}

	.section-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.35rem 1.35rem 0;
	}

	.content {
		padding: 1.35rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h2 {
		margin: 0;
		font-size: clamp(1.05rem, 2vw, 1.45rem);
	}

	.description {
		margin: 0.45rem 0 0;
		color: var(--ink-soft);
		line-height: 1.6;
		max-width: 72ch;
	}

	.actions {
		flex-shrink: 0;
	}

	@media (max-width: 720px) {
		.section-head {
			flex-direction: column;
		}
	}
</style>
