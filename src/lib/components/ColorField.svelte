<script lang="ts">
	import { browser } from '$app/environment';
	import { createEventDispatcher } from 'svelte';
	import { clampRgb, converter, formatHex, parse } from 'culori';
	import Tooltip from './Tooltip.svelte';

	export let label = '';
	export let description = '';
	export let value = '';
	export let alpha = 1;
	export let preview = 'rgb(255 255 255)';
	export let hexValue = '';
	export let oklchValue = '';
	export let luminance = '';
	export let error = '';

	type EditorTab = 'visual' | 'channels';
	type ChannelMode = 'rgb' | 'hsl';

	const dispatch = createEventDispatcher<{
		change: string;
		alpha: number;
	}>();

	const toRgb = converter('rgb');
	const toHsl = converter('hsl');

	let picking = false;
	let copied = false;
	let editorTab: EditorTab = 'visual';
	let channelMode: ChannelMode = 'rgb';

	$: parsed = parse(value);
	$: rgb = clampRgb(toRgb(parsed ?? '#000000')) ?? { r: 0, g: 0, b: 0, alpha: 1 };
	$: hsl = toHsl(parsed ?? '#000000') ?? { h: 0, s: 0, l: 0 };
	$: rgbChannels = {
		r: Math.round((rgb.r ?? 0) * 255),
		g: Math.round((rgb.g ?? 0) * 255),
		b: Math.round((rgb.b ?? 0) * 255)
	};
	$: hslChannels = {
		h: Math.round((hsl.h ?? 0) % 360),
		s: Math.round((hsl.s ?? 0) * 100),
		l: Math.round((hsl.l ?? 0) * 100)
	};
	$: pickerHex = parsed ? formatHex(parsed) : '#000000';

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

	function updatePicker(event: Event) {
		dispatch('change', (event.currentTarget as HTMLInputElement).value);
	}

	function updateRgbChannel(channel: 'r' | 'g' | 'b', next: number) {
		const values = { ...rgbChannels, [channel]: next };
		dispatch('change', `rgb(${values.r} ${values.g} ${values.b})`);
	}

	function updateHslChannel(channel: 'h' | 's' | 'l', next: number) {
		const values = { ...hslChannels, [channel]: next };
		dispatch('change', `hsl(${values.h} ${values.s}% ${values.l}%)`);
	}

	async function copyCurrent() {
		if (!browser || !navigator.clipboard || !value) {
			return;
		}

		await navigator.clipboard.writeText(value);
		copied = true;
		window.setTimeout(() => {
			copied = false;
		}, 1400);
	}
</script>

<div class="field">
	<div class="field-header">
		<div class="identity">
			<div class="swatch-shell">
				<div class="checker"></div>
				<div class="swatch" style={`background:${preview}`}></div>
				<input
					class="native-picker"
					type="color"
					value={pickerHex}
					aria-label={`Selector visual para ${label}`}
					on:input={updatePicker}
				/>
			</div>

			<div class="meta">
				<div class="title-row">
					<p class="label">{label}</p>
					<Tooltip content={description} label={`Info sobre ${label}`} />
				</div>
				<p class="description">{description}</p>
			</div>
		</div>

		<div class="field-actions">
			<button class="action action-accent" type="button" on:click={pickFromScreen} disabled={picking}>
				{picking ? 'Capturando…' : 'Tomar color'}
			</button>
			<button class="action" type="button" on:click={copyCurrent}>
				{copied ? 'Copiado' : 'Copiar'}
			</button>
		</div>
	</div>

	<div class="control-grid">
		<label class="input-shell">
			<span>Valor</span>
			<input
				type="text"
				value={value}
				on:input={(event) => dispatch('change', (event.currentTarget as HTMLInputElement).value)}
				placeholder="#0f172a / rgb() / hsl() / oklch()"
				spellcheck="false"
			/>
		</label>

		<label class="picker-shell">
			<span>Selector</span>
			<div class="picker-box">
				<input type="color" value={pickerHex} aria-label={`Color picker para ${label}`} on:input={updatePicker} />
				<strong>{pickerHex}</strong>
			</div>
		</label>
	</div>

	<div class="editor-toggle">
		<div class="segmented">
			<button type="button" class:active={editorTab === 'visual'} on:click={() => (editorTab = 'visual')}>Resumen</button>
			<button type="button" class:active={editorTab === 'channels'} on:click={() => (editorTab = 'channels')}>Canales</button>
		</div>

		{#if editorTab === 'channels'}
			<div class="segmented compact">
				<button type="button" class:active={channelMode === 'rgb'} on:click={() => (channelMode = 'rgb')}>RGB</button>
				<button type="button" class:active={channelMode === 'hsl'} on:click={() => (channelMode = 'hsl')}>HSL</button>
			</div>
		{/if}
	</div>

	{#if editorTab === 'visual'}
		<div class="stats">
			<span>{hexValue}</span>
			<span>{oklchValue}</span>
			<span>Y {luminance}</span>
		</div>
	{:else}
		<div class="channel-editor">
			<div class="editor-caption">
				<p>{channelMode === 'rgb' ? 'Ajusta canales RGB' : 'Ajusta canales HSL'}</p>
				<span>Los sliders actualizan el valor en tiempo real.</span>
			</div>

			{#if channelMode === 'rgb'}
				<label class="channel">
					<div class="channel-head"><span>Red</span><strong>{rgbChannels.r}</strong></div>
					<input type="range" min="0" max="255" step="1" value={rgbChannels.r} on:input={(event) => updateRgbChannel('r', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
				<label class="channel">
					<div class="channel-head"><span>Green</span><strong>{rgbChannels.g}</strong></div>
					<input type="range" min="0" max="255" step="1" value={rgbChannels.g} on:input={(event) => updateRgbChannel('g', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
				<label class="channel">
					<div class="channel-head"><span>Blue</span><strong>{rgbChannels.b}</strong></div>
					<input type="range" min="0" max="255" step="1" value={rgbChannels.b} on:input={(event) => updateRgbChannel('b', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
			{:else}
				<label class="channel">
					<div class="channel-head"><span>Hue</span><strong>{hslChannels.h}</strong></div>
					<input type="range" min="0" max="360" step="1" value={hslChannels.h} on:input={(event) => updateHslChannel('h', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
				<label class="channel">
					<div class="channel-head"><span>Saturation</span><strong>{hslChannels.s}%</strong></div>
					<input type="range" min="0" max="100" step="1" value={hslChannels.s} on:input={(event) => updateHslChannel('s', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
				<label class="channel">
					<div class="channel-head"><span>Lightness</span><strong>{hslChannels.l}%</strong></div>
					<input type="range" min="0" max="100" step="1" value={hslChannels.l} on:input={(event) => updateHslChannel('l', Number((event.currentTarget as HTMLInputElement).value))} />
				</label>
			{/if}
		</div>
	{/if}

	<label class="range">
		<div class="title-row">
			<span>Alpha {Math.round(alpha * 100)}%</span>
			<Tooltip content="El contraste se calcula usando la opacidad real del foreground o background al componerse sobre el surface." label={`Info sobre alpha en ${label}`} />
		</div>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={alpha}
			on:input={(event) => dispatch('alpha', Number((event.currentTarget as HTMLInputElement).value))}
		/>
	</label>

	{#if error}
		<p class="error">{error}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		border-radius: 22px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-md);
		min-width: 0;
		overflow: hidden;
		container-type: inline-size;
	}

	.field-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: start;
	}

	.identity {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.9rem;
		align-items: center;
		min-width: 0;
	}

	.swatch-shell {
		position: relative;
		width: 4rem;
		height: 4rem;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--line-strong);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.checker,
	.swatch,
	.native-picker {
		position: absolute;
		inset: 0;
	}

	.checker {
		background:
			linear-gradient(45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.12) 75%),
			linear-gradient(45deg, rgba(255, 255, 255, 0.12) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.12) 75%);
		background-position: 0 0, 10px 10px;
		background-size: 20px 20px;
		background-color: rgba(15, 23, 42, 0.08);
	}

	.native-picker {
		opacity: 0;
		cursor: pointer;
	}

	.meta {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.label {
		margin: 0;
		font-weight: 700;
		font-size: 1.05rem;
	}

	.description {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.field-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.action {
		border-radius: 12px;
		border: 1px solid var(--line-strong);
		background: var(--surface-3);
		color: var(--ink-strong);
		padding: 0.72rem 0.85rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.action:hover,
	.action:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px var(--accent-soft);
		outline: none;
	}

	.action:active {
		transform: translateY(1px);
	}

	.action-accent {
		background: var(--accent);
		border-color: transparent;
		color: white;
	}

	.action:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.control-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 9.5rem;
		gap: 0.75rem;
		align-items: end;
	}

	.input-shell,
	.picker-shell,
	.range,
	.channel {
		display: grid;
		gap: 0.45rem;
		min-width: 0;
	}

	.input-shell span,
	.picker-shell span,
	.range span,
	.channel span {
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	input[type='text'] {
		width: 100%;
		padding: 0.92rem 1rem;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: #fff;
		color: var(--ink-strong);
	}

	:global(html[data-theme='dark']) input[type='text'] {
		background: var(--surface-3);
	}

	.picker-box {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		height: 3.35rem;
		padding: 0.55rem 0.65rem;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: #fff;
	}

	:global(html[data-theme='dark']) .picker-box {
		background: var(--surface-3);
	}

	.picker-box input[type='color'] {
		width: 2rem;
		height: 2rem;
		border: 0;
		background: none;
		padding: 0;
		flex: 0 0 auto;
	}

	.picker-box strong {
		font-size: 0.84rem;
		line-height: 1.2;
	}

	.editor-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.segmented {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: var(--surface-3);
	}

	.segmented button {
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		padding: 0.58rem 0.82rem;
		border-radius: 10px;
		font-weight: 600;
	}

	.segmented button.active {
		background: var(--accent);
		color: white;
		box-shadow: var(--button-shadow);
	}

	.channel-editor {
		display: grid;
		gap: 0.75rem;
		padding: 0.9rem;
		border-radius: 18px;
		background: rgba(79, 110, 247, 0.03);
		border: 1px solid var(--line);
	}

	.editor-caption {
		display: grid;
		gap: 0.18rem;
	}

	.editor-caption p,
	.editor-caption span {
		margin: 0;
	}

	.editor-caption p {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--ink-strong);
	}

	.editor-caption span {
		font-size: 0.8rem;
		color: var(--ink-soft);
	}

	.channel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.channel strong {
		font-size: 0.9rem;
		color: var(--ink-strong);
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
		padding: 0.42rem 0.68rem;
		border-radius: 999px;
		background: rgba(79, 110, 247, 0.05);
		border: 1px solid var(--line);
		font-size: 0.78rem;
	}

	.error {
		margin: 0;
		color: #c54559;
		border-color: rgba(208, 87, 107, 0.26);
		background: rgba(208, 87, 107, 0.08);
	}

	@container (max-width: 430px) {
		.field-header,
		.control-grid {
			grid-template-columns: 1fr;
		}

		.field-actions {
			justify-content: flex-start;
		}

		.editor-toggle {
			flex-direction: column;
			align-items: stretch;
		}

		.segmented {
			width: 100%;
		}

		.segmented button {
			flex: 1;
		}
	}

	@container (max-width: 320px) {
		.identity {
			grid-template-columns: 1fr;
			align-items: start;
		}
	}
</style>
