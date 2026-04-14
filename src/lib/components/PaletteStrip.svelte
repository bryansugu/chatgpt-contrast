<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PaletteTone } from '$lib/color/types';

	export let title = '';
	export let theme: 'light' | 'dark' = 'light';
	export let tones: PaletteTone[] = [];
	export let selectedStep = 8;

	const dispatch = createEventDispatcher<{ select: number }>();
</script>

<div class="palette-strip">
	<div class="strip-head">
		<h3>{title}</h3>
		<span>{theme === 'light' ? 'modo claro' : 'modo oscuro'}</span>
	</div>

	<div class="tiles">
		{#each tones as tone}
			<button
				type="button"
				class:selected={tone.step === selectedStep}
				style={`background:${tone.hex}; color:${tone.contrastOnWhite > tone.contrastOnBlack ? '#f8fafc' : '#020617'}`}
				on:click={() => dispatch('select', tone.step)}
			>
				<strong>{tone.step}</strong>
				<span>{tone.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.palette-strip {
		display: grid;
		gap: 1rem;
	}

	.strip-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.85rem;
	}

	h3,
	span {
		margin: 0;
	}

	.strip-head span {
		color: var(--ink-soft);
		font-size: 0.88rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 0.6rem;
	}

	button {
		min-height: 7.5rem;
		border-radius: 18px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 0.65rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: space-between;
		text-align: left;
		transition:
			transform 180ms ease,
			box-shadow 180ms ease,
			border-color 180ms ease;
	}

	button:hover,
	button.selected {
		transform: translateY(-2px);
		box-shadow: 0 18px 42px rgba(2, 6, 23, 0.32);
		border-color: rgba(255, 255, 255, 0.32);
	}

	strong {
		font-size: 1.05rem;
	}

	span {
		font-size: 0.76rem;
		line-height: 1.25;
		max-width: 9ch;
	}

	@media (max-width: 1100px) {
		.tiles {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
