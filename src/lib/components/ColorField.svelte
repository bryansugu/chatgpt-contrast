<script lang="ts">
	import { browser } from '$app/environment';
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let description = '';
	export let value = '';
	export let alpha = 1;
	export let preview = 'rgb(255 255 255)';
	export let hexValue = '';
	export let oklchValue = '';
	export let luminance = '';
	export let error = '';

	const dispatch = createEventDispatcher<{
		change: string;
		alpha: number;
	}>();

	let picking = false;

	async function pickFromScreen() {
		if (!browser || !('EyeDropper' in window)) {
			return;
		}

		picking = true;

		try {
			const eyeDropper = new EyeDropper();
			const result = await eyeDropper.open();
			dispatch('change', result.sRGBHex);
		} catch (error) {
			console.debug(error);
		} finally {
			picking = false;
		}
	}
</script>

<div class="field">
	<div class="field-top">
		<div class="swatch-shell">
			<div class="checker"></div>
			<div class="swatch" style={`background:${preview}`}></div>
		</div>

		<div class="meta">
			<p class="label">{label}</p>
			<p class="description">{description}</p>
		</div>

		<button class="picker" type="button" on:click={pickFromScreen} disabled={picking}>
			{picking ? 'Capturando…' : 'EyeDropper'}
		</button>
	</div>

	<label class="input-shell">
		<span class="sr-only">{label}</span>
		<input
			type="text"
			value={value}
			on:input={(event) => dispatch('change', (event.currentTarget as HTMLInputElement).value)}
			placeholder="#0f172a / rgb() / hsl() / oklch()"
			spellcheck="false"
		/>
	</label>

	<label class="range">
		<span>Alpha {Math.round(alpha * 100)}%</span>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={alpha}
			on:input={(event) => dispatch('alpha', Number((event.currentTarget as HTMLInputElement).value))}
		/>
	</label>

	<div class="stats">
		<span>{hexValue}</span>
		<span>{oklchValue}</span>
		<span>Y {luminance}</span>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.018);
		border: 1px solid var(--line);
	}

	.field-top {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.9rem;
		align-items: center;
	}

	.swatch-shell {
		position: relative;
		width: 3.35rem;
		height: 3.35rem;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--line-strong);
	}

	.checker,
	.swatch {
		position: absolute;
		inset: 0;
	}

	.checker {
		background:
			linear-gradient(45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.12) 75%),
			linear-gradient(45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.12) 75%);
		background-position: 0 0, 10px 10px;
		background-size: 20px 20px;
		background-color: rgba(15, 23, 42, 0.7);
	}

	.label {
		margin: 0;
		font-weight: 700;
	}

	.description {
		margin: 0.25rem 0 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.picker,
	.input-shell,
	.range,
	input {
		font: inherit;
	}

	.picker {
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.03);
		color: var(--ink-strong);
		border-radius: 999px;
		padding: 0.7rem 0.95rem;
	}

	.input-shell {
		display: block;
	}

	input[type='text'] {
		width: 100%;
		padding: 0.95rem 1rem;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface-3);
		color: var(--ink-strong);
	}

	.range {
		display: grid;
		gap: 0.55rem;
		color: var(--ink-soft);
		font-size: 0.88rem;
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.stats span,
	.error {
		padding: 0.42rem 0.64rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.028);
		border: 1px solid var(--line);
		font-size: 0.78rem;
	}

	.error {
		margin: 0;
		color: #f2d8d6;
		border-color: rgba(197, 130, 130, 0.26);
		background: rgba(197, 130, 130, 0.08);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	@media (max-width: 720px) {
		.field-top {
			grid-template-columns: auto 1fr;
		}

		.picker {
			grid-column: 1 / -1;
		}
	}
</style>
