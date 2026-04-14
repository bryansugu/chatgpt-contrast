<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ColorField from '$lib/components/ColorField.svelte';
	import ContrastGraph from '$lib/components/ContrastGraph.svelte';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import PaletteStrip from '$lib/components/PaletteStrip.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import {
		AMBIENT_CONDITIONS,
		DEFAULT_SEMANTIC_COLORS,
		PRESET_PAIRS,
		PRINT_MODES,
		STORAGE_KEYS,
		VISION_CONDITIONS
	} from '$lib/color/constants';
	import {
		alphaCurve,
		apcaContrastValue,
		applyAnalysisPipeline,
		buildSemanticPairScore,
		colorDistanceDescription,
		compositeColors,
		contrastSpectrumPosition,
		contrastSummary,
		deltaOklab,
		evaluateCriteria,
		fatigueStatus,
		findMinimumAlpha,
		luminanceY,
		parseUserColor,
		polarityLabel,
		ratioMarginLabel,
		rgbaToCss,
		rgbaToHex,
		rgbaToOklchString,
		simulateVision,
		withAlpha,
		wcagContrast
	} from '$lib/color/engine';
	import { exportCssVariables, exportDesignTokens, exportTailwindConfig } from '$lib/color/exporters';
	import { generateDarkModePair, generatePalette } from '$lib/color/palette';
	import type {
		AmbientConditionId,
		PairHistoryEntry,
		PrintModeId,
		RgbaColor,
		VisionConditionId
	} from '$lib/color/types';

	let foregroundInput = '#0f172a';
	let backgroundInput = '#f8fafc';
	let surfaceInput = '#ffffff';
	let paletteInput = '#2563eb';
	let paletteName = 'accent';

	let foregroundAlpha = 1;
	let backgroundAlpha = 1;
	let surfaceAlpha = 1;

	let selectedVision: VisionConditionId = 'normal';
	let selectedAmbient: AmbientConditionId = 'office';
	let selectedPrint: PrintModeId = 'screen';

	let selectedLightStep = 8;
	let selectedDarkStep = 8;

	let semanticError = DEFAULT_SEMANTIC_COLORS.error;
	let semanticSuccess = DEFAULT_SEMANTIC_COLORS.success;
	let semanticWarning = DEFAULT_SEMANTIC_COLORS.warning;
	let semanticInfo = DEFAULT_SEMANTIC_COLORS.info;

	let history: PairHistoryEntry[] = [];
	let saveTimer: number | undefined;
	let lastHistorySignature = '';
	let copied = '';

	function setColorInput(layer: 'foreground' | 'background' | 'surface' | 'palette', value: string) {
		if (layer === 'foreground') {
			foregroundInput = value;
			const parsed = parseUserColor(value);
			if (parsed.ok) foregroundAlpha = parsed.color.alpha;
			return;
		}

		if (layer === 'background') {
			backgroundInput = value;
			const parsed = parseUserColor(value);
			if (parsed.ok) backgroundAlpha = parsed.color.alpha;
			return;
		}

		if (layer === 'surface') {
			surfaceInput = value;
			const parsed = parseUserColor(value);
			if (parsed.ok) surfaceAlpha = parsed.color.alpha;
			return;
		}

		paletteInput = value;
	}

	function applyPreset(preset: { fg: string; bg: string; surface: string }) {
		setColorInput('foreground', preset.fg);
		setColorInput('background', preset.bg);
		setColorInput('surface', preset.surface);
	}

	async function copyText(label: string, value: string) {
		if (!browser || !navigator.clipboard) {
			return;
		}

		await navigator.clipboard.writeText(value);
		copied = `${label} copiado`;
		window.setTimeout(() => {
			if (copied === `${label} copiado`) copied = '';
		}, 1800);
	}

	function savePairToHistory() {
		if (!browser || !analysisReady) {
			return;
		}

		const signature = `${foregroundInput}|${backgroundInput}|${surfaceInput}`;
		if (signature === lastHistorySignature) {
			return;
		}

		lastHistorySignature = signature;
		const nextEntry: PairHistoryEntry = {
			id: crypto.randomUUID(),
			fg: foregroundInput,
			bg: backgroundInput,
			surface: surfaceInput,
			savedAt: new Date().toISOString()
		};

		history = [nextEntry, ...history.filter((item) => `${item.fg}|${item.bg}|${item.surface}` !== signature)].slice(
			0,
			8
		);
		localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
	}

	function loadFromHistory(entry: PairHistoryEntry) {
		applyPreset(entry);
	}

	function readHistory() {
		if (!browser) {
			return;
		}

		const raw = localStorage.getItem(STORAGE_KEYS.history);
		if (!raw) {
			return;
		}

		try {
			history = JSON.parse(raw) as PairHistoryEntry[];
		} catch (error) {
			console.debug(error);
		}
	}

	onMount(() => {
		readHistory();

		return () => {
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	$: foregroundParsed = parseUserColor(foregroundInput);
	$: backgroundParsed = parseUserColor(backgroundInput);
	$: surfaceParsed = parseUserColor(surfaceInput);
	$: paletteParsed = parseUserColor(paletteInput);

	$: foregroundColor = foregroundParsed.ok ? withAlpha(foregroundParsed.color, foregroundAlpha) : null;
	$: backgroundColor = backgroundParsed.ok ? withAlpha(backgroundParsed.color, backgroundAlpha) : null;
	$: surfaceColor = surfaceParsed.ok ? withAlpha(surfaceParsed.color, surfaceAlpha) : null;
	$: analysisReady = Boolean(foregroundColor && backgroundColor && surfaceColor);

	$: pipeline =
		analysisReady && foregroundColor && backgroundColor && surfaceColor
			? applyAnalysisPipeline(foregroundColor, backgroundColor, surfaceColor, {
					vision: selectedVision,
					ambient: selectedAmbient,
					printMode: selectedPrint
				})
			: null;

	$: ratio = pipeline ? wcagContrast(pipeline.foreground, pipeline.background) : 0;
	$: apca = pipeline ? apcaContrastValue(pipeline.foreground, pipeline.background) : 0;
	$: criteria = pipeline ? evaluateCriteria(pipeline.foreground, pipeline.background) : [];
	$: criteriaSummary = contrastSummary(criteria);
	$: fatigue = fatigueStatus(ratio);
	$: fatiguePosition = contrastSpectrumPosition(ratio);
	$: alphaSamples =
		analysisReady && foregroundColor && backgroundColor && surfaceColor
			? alphaCurve(foregroundColor, backgroundColor, surfaceColor, {
					vision: selectedVision,
					ambient: selectedAmbient,
					printMode: selectedPrint
				})
			: [];
	$: minimumAlpha =
		analysisReady && foregroundColor && backgroundColor && surfaceColor
			? findMinimumAlpha(foregroundColor, backgroundColor, surfaceColor, {
					vision: selectedVision,
					ambient: selectedAmbient,
					printMode: selectedPrint
				})
			: null;

	$: previewForeground = pipeline ? rgbaToCss(pipeline.foreground) : 'rgb(241 245 249)';
	$: previewBackground = pipeline ? rgbaToCss(pipeline.background) : 'rgb(15 23 42)';
	$: previewBorder =
		pipeline && pipeline.background
			? rgbaToCss(compositeColors(withAlpha(pipeline.foreground, 0.18), withAlpha(pipeline.background, 1)))
			: 'rgb(148 163 184 / 0.24)';
	$: previewSoft =
		pipeline && pipeline.background
			? rgbaToCss(compositeColors(withAlpha(pipeline.foreground, 0.08), withAlpha(pipeline.background, 1)))
			: 'rgb(30 41 59)';

	$: darkModePair =
		pipeline && pipeline.baseForeground && pipeline.baseBackground
			? generateDarkModePair(pipeline.baseForeground, pipeline.baseBackground, ratio)
			: null;

	$: palette = generatePalette(paletteInput);
	$: selectedLightTone = palette.light.find((tone) => tone.step === selectedLightStep) ?? palette.light[7];
	$: selectedDarkTone = palette.dark.find((tone) => tone.step === selectedDarkStep) ?? palette.dark[7];
	$: cssExport = exportCssVariables(paletteName, palette);
	$: tailwindExport = exportTailwindConfig(paletteName, palette);
	$: dtcgExport = exportDesignTokens(paletteName, palette);

	function parseSemantic(input: string) {
		const parsed = parseUserColor(input);
		return parsed.ok ? parsed.color : null;
	}

	$: semanticColors = {
		error: parseSemantic(semanticError),
		success: parseSemantic(semanticSuccess),
		warning: parseSemantic(semanticWarning),
		info: parseSemantic(semanticInfo)
	};

	$: semanticConditionSummaries = VISION_CONDITIONS.map((condition) => {
		const transformed = Object.entries(semanticColors)
			.map(([name, color]) => (color ? [name, simulateVision(color, condition.id)] : null))
			.filter(Boolean) as [string, RgbaColor][];

		const scores = [];

		for (let i = 0; i < transformed.length; i += 1) {
			for (let j = i + 1; j < transformed.length; j += 1) {
				scores.push(buildSemanticPairScore(transformed[i][0], transformed[j][0], transformed[i][1], transformed[j][1]));
			}
		}

		return {
			condition,
			clear: scores.filter((score) => score.status === 'clear').length,
			borderline: scores.filter((score) => score.status === 'borderline').length,
			risky: scores.filter((score) => score.status === 'risky').length,
			scores
		};
	});

	$: currentSemanticSummary =
		semanticConditionSummaries.find((item) => item.condition.id === selectedVision) ?? semanticConditionSummaries[0];

	$: outdoorScenarios =
		analysisReady && foregroundColor && backgroundColor && surfaceColor
			? AMBIENT_CONDITIONS.map((condition) => {
					const scenario = applyAnalysisPipeline(foregroundColor, backgroundColor, surfaceColor, {
						vision: selectedVision,
						ambient: condition.id,
						printMode: selectedPrint
					});

					return {
						condition,
						background: rgbaToCss(scenario.background),
						foreground: rgbaToCss(scenario.foreground),
						ratio: wcagContrast(scenario.foreground, scenario.background),
						apca: apcaContrastValue(scenario.foreground, scenario.background)
					};
				})
			: [];

	$: printScenarios =
		analysisReady && foregroundColor && backgroundColor && surfaceColor
			? PRINT_MODES.map((mode) => {
					const scenario = applyAnalysisPipeline(foregroundColor, backgroundColor, surfaceColor, {
						vision: selectedVision,
						ambient: selectedAmbient,
						printMode: mode.id
					});

					return {
						mode,
						background: rgbaToCss(scenario.background),
						foreground: rgbaToCss(scenario.foreground),
						ratio: wcagContrast(scenario.foreground, scenario.background)
					};
				})
			: [];

	$: recommendedPalettePairs =
		palette.light.length && palette.dark.length
			? [
					{
						label: 'Light app surface',
						background: palette.light[0],
						foreground: palette.light[10]
					},
					{
						label: 'Light solid CTA',
						background: palette.light[7],
						foreground: palette.light[0]
					},
					{
						label: 'Dark canvas text',
						background: palette.dark[0],
						foreground: palette.dark[10]
					},
					{
						label: 'Dark solid button',
						background: palette.dark[7],
						foreground: palette.dark[11]
					}
				].map((item) => {
					const background = parseUserColor(item.background.hex);
					const foreground = parseUserColor(item.foreground.hex);
					return {
						...item,
						ratio:
							background.ok && foreground.ok ? wcagContrast(foreground.color, background.color) : 0,
						apca:
							background.ok && foreground.ok
								? Math.abs(apcaContrastValue(foreground.color, background.color))
								: 0
					};
				})
			: [];

	$: if (browser && analysisReady) {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => {
			savePairToHistory();
		}, 700);
	}

	function toneClass(status: string) {
		if (status === 'clear' || status === 'optimal') return 'good';
		if (status === 'borderline' || status === 'moderate') return 'warn';
		return 'bad';
	}

	function metricTone(results: typeof criteria) {
		const failed = results.filter((item) => !item.passed).length;
		if (failed === 0) return 'success';
		if (failed <= 3) return 'warning';
		return 'danger';
	}
</script>

<svelte:head>
	<title>ChromaCheck</title>
	<meta
		name="description"
		content="Herramienta profesional de contraste, APCA, simulación de visión, alpha compositing y generación de paletas en Svelte."
	/>
</svelte:head>

<div class="page">
	<section class="hero">
		<div class="hero-copy">
			<p class="badge">ChromaCheck · SvelteKit 2 + Svelte 5</p>
			<h1>Contraste, accesibilidad y generación de color con criterio real.</h1>
			<p class="lede">
				Analiza un par de colores con alpha real, WCAG 2.2, APCA, visión simulada, luz exterior,
				impresión y paletas perceptuales listas para diseño systems.
			</p>

			<div class="hero-actions">
				<a href="#checker">Abrir checker</a>
				<a href="#palette">Ir a paletas</a>
			</div>
		</div>

		<div class="hero-panel" style={`--fg:${previewForeground}; --bg:${previewBackground}; --bd:${previewBorder}; --soft:${previewSoft};`}>
			<div class="hero-chip">
				<span>Simulación activa</span>
				<strong>
					{VISION_CONDITIONS.find((item) => item.id === selectedVision)?.label},
					{AMBIENT_CONDITIONS.find((item) => item.id === selectedAmbient)?.label}
				</strong>
			</div>

			<div class="hero-demo">
				<div class="card headline">
					<p>Typography</p>
					<h2>Readable by default</h2>
					<span>WCAG + APCA sobre color compuesto</span>
				</div>
				<div class="card stat">
					<p>Ratio</p>
					<strong>{ratio ? `${ratio.toFixed(2)}:1` : '—'}</strong>
					<span>APCA {Math.abs(apca).toFixed(1)} Lc</span>
				</div>
			</div>
		</div>
	</section>

	<section class="control-bar">
		<label>
			<span>Visión</span>
			<select bind:value={selectedVision}>
				{#each VISION_CONDITIONS as condition}
					<option value={condition.id}>{condition.label}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Luz ambiental</span>
			<select bind:value={selectedAmbient}>
				{#each AMBIENT_CONDITIONS as condition}
					<option value={condition.id}>{condition.label}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Salida</span>
			<select bind:value={selectedPrint}>
				{#each PRINT_MODES as mode}
					<option value={mode.id}>{mode.label}</option>
				{/each}
			</select>
		</label>

		{#if copied}
			<div class="copied">{copied}</div>
		{/if}
	</section>

	<div class="main-grid" id="checker">
		<div class="stack">
			<SectionCard
				eyebrow="Input"
				title="Capas y alpha compositing"
				description="Foreground y background aceptan transparencia. El surface define el lienzo final cuando el background también tiene alpha."
			>
				<div class="color-grid">
					<ColorField
						label="Foreground"
						description="Texto o iconografía principal."
						value={foregroundInput}
						alpha={foregroundAlpha}
						preview={foregroundColor ? rgbaToCss(foregroundColor) : 'rgb(15 23 42)'}
						hexValue={foregroundColor ? rgbaToHex(foregroundColor) : '—'}
						oklchValue={foregroundColor ? rgbaToOklchString(foregroundColor) : '—'}
						luminance={foregroundColor ? luminanceY(foregroundColor).toFixed(4) : '—'}
						error={foregroundParsed.ok ? '' : foregroundParsed.error}
						on:change={(event) => setColorInput('foreground', event.detail)}
						on:alpha={(event) => (foregroundAlpha = event.detail)}
					/>

					<ColorField
						label="Background"
						description="Panel o superficie inmediata."
						value={backgroundInput}
						alpha={backgroundAlpha}
						preview={backgroundColor ? rgbaToCss(backgroundColor) : 'rgb(248 250 252)'}
						hexValue={backgroundColor ? rgbaToHex(backgroundColor) : '—'}
						oklchValue={backgroundColor ? rgbaToOklchString(backgroundColor) : '—'}
						luminance={backgroundColor ? luminanceY(backgroundColor).toFixed(4) : '—'}
						error={backgroundParsed.ok ? '' : backgroundParsed.error}
						on:change={(event) => setColorInput('background', event.detail)}
						on:alpha={(event) => (backgroundAlpha = event.detail)}
					/>

					<ColorField
						label="Surface"
						description="Canvas base para resolver transparencias."
						value={surfaceInput}
						alpha={surfaceAlpha}
						preview={surfaceColor ? rgbaToCss(surfaceColor) : 'rgb(255 255 255)'}
						hexValue={surfaceColor ? rgbaToHex(surfaceColor) : '—'}
						oklchValue={surfaceColor ? rgbaToOklchString(surfaceColor) : '—'}
						luminance={surfaceColor ? luminanceY(surfaceColor).toFixed(4) : '—'}
						error={surfaceParsed.ok ? '' : surfaceParsed.error}
						on:change={(event) => setColorInput('surface', event.detail)}
						on:alpha={(event) => (surfaceAlpha = event.detail)}
					/>
				</div>

				<div class="preset-row">
					<div class="preset-block">
						<span class="micro-label">Presets</span>
						<div class="chips">
							{#each PRESET_PAIRS as preset}
								<button type="button" class="chip" on:click={() => applyPreset(preset)}>{preset.name}</button>
							{/each}
						</div>
					</div>

					<div class="preset-block">
						<span class="micro-label">Historial</span>
						<div class="chips">
							{#if history.length}
								{#each history as entry}
									<button type="button" class="chip ghost" on:click={() => loadFromHistory(entry)}>
										{entry.fg} / {entry.bg}
									</button>
								{/each}
							{:else}
								<span class="empty">Se irán guardando los últimos 8 pares válidos.</span>
							{/if}
						</div>
					</div>
				</div>
			</SectionCard>

			<SectionCard
				eyebrow="Preview"
				title="Visualizador contextual"
				description="La simulación seleccionada afecta tanto la vista como los cálculos del contraste efectivo."
			>
				<div class="preview-grid" style={`--preview-fg:${previewForeground}; --preview-bg:${previewBackground}; --preview-border:${previewBorder}; --preview-soft:${previewSoft};`}>
					<article class="preview-card typography">
						<span class="preview-kicker">Tipografía</span>
						<h3>Readability under pressure</h3>
						<p>
							Cuerpo de texto, subtítulos y llamadas de atención sobre el color resultante después de composición,
							simulación visual y soporte de impresión.
						</p>
					</article>

					<article class="preview-card buttons">
						<span class="preview-kicker">Botones</span>
						<div class="button-row">
							<button type="button" class="preview-button filled">Primary</button>
							<button type="button" class="preview-button outline">Secondary</button>
						</div>
					</article>

					<article class="preview-card forms">
						<span class="preview-kicker">Formularios</span>
						<label>
							<span>Email</span>
							<input type="text" value="hello@chromacheck.dev" readonly />
						</label>
					</article>

					<article class="preview-card nav">
						<span class="preview-kicker">Navegación</span>
						<nav>
							<a class="active" href="#checker">Overview</a>
							<a href="#checker">Audit</a>
							<a href="#palette">Palette</a>
						</nav>
					</article>

					<article class="preview-card table">
						<span class="preview-kicker">Tablas</span>
						<table>
							<tbody>
								<tr><th>Token</th><th>Ratio</th></tr>
								<tr><td>solid / text</td><td>{ratio.toFixed(2)}:1</td></tr>
								<tr><td>APCA</td><td>{Math.abs(apca).toFixed(1)} Lc</td></tr>
							</tbody>
						</table>
					</article>

					<article class="preview-card alert">
						<span class="preview-kicker">Alertas</span>
						<div class="alert-box">
							<strong>Status warning</strong>
							<p>Revisa semántica, distinguishability y contraste de UI.</p>
						</div>
					</article>
				</div>
			</SectionCard>
		</div>

		<div class="stack">
			<SectionCard
				eyebrow="Audit"
				title="Contraste calculado"
				description="WCAG 2.2 y APCA sobre el par compuesto final, respetando la condición visual activa."
			>
				<div class="metric-grid">
					<MetricCard
						label="WCAG ratio"
						value={ratio ? `${ratio.toFixed(2)}:1` : '—'}
						detail="Relación final de luminancia"
						tone={ratio >= 7 ? 'success' : ratio >= 4.5 ? 'warning' : 'danger'}
					/>
					<MetricCard
						label="APCA"
						value={analysisReady ? `${Math.abs(apca).toFixed(1)} Lc` : '—'}
						detail={analysisReady ? polarityLabel(apca) : '—'}
						tone={Math.abs(apca) >= 75 ? 'success' : Math.abs(apca) >= 60 ? 'warning' : 'danger'}
					/>
					<MetricCard
						label="Criterios"
						value={criteriaSummary}
						detail="Aprobados sobre 11 checks"
						tone={metricTone(criteria)}
					/>
					<MetricCard
						label="Fatiga"
						value={fatigue.label}
						detail={fatigue.description}
						tone={fatigue.tone === 'optimal' ? 'success' : fatigue.tone === 'moderate' ? 'warning' : 'danger'}
					/>
				</div>

				<div class="criterion-list">
					{#each criteria as item}
						<article class:itemPass={item.passed} class="criterion">
							<div>
								<strong>{item.criterion.shortLabel}</strong>
								<p>{item.criterion.note}</p>
							</div>
							<div class="criterion-metrics">
								<span>{item.criterion.unit === 'ratio' ? `${item.value.toFixed(2)}:1` : `${item.value.toFixed(1)} Lc`}</span>
								<em>{ratioMarginLabel(item.value, item.criterion.threshold, item.criterion.unit)}</em>
							</div>
						</article>
					{/each}
				</div>
			</SectionCard>

			<SectionCard
				eyebrow="Signals"
				title="Capas efectivas"
				description="Estos son los colores visibles resultantes después de resolver alpha y aplicar las simulaciones seleccionadas."
			>
				<div class="effective-pair">
					<div class="effective-swatch">
						<div class="bg" style={`background:${previewBackground}`}></div>
						<div class="fg" style={`background:${previewForeground}`}></div>
					</div>
					<div class="effective-meta">
						<div>
							<span class="micro-label">Foreground visible</span>
							<strong>{pipeline ? rgbaToHex(pipeline.foreground) : '—'}</strong>
							<p>{pipeline ? rgbaToOklchString(pipeline.foreground) : '—'}</p>
						</div>
						<div>
							<span class="micro-label">Background visible</span>
							<strong>{pipeline ? rgbaToHex(pipeline.background) : '—'}</strong>
							<p>{pipeline ? rgbaToOklchString(pipeline.background) : '—'}</p>
						</div>
						<div>
							<span class="micro-label">Condición</span>
							<strong>{VISION_CONDITIONS.find((item) => item.id === selectedVision)?.label}</strong>
							<p>{PRINT_MODES.find((item) => item.id === selectedPrint)?.label} · {AMBIENT_CONDITIONS.find((item) => item.id === selectedAmbient)?.label}</p>
						</div>
					</div>
				</div>
			</SectionCard>
		</div>
	</div>

	<div class="module-grid">
		<SectionCard
			eyebrow="Module"
			title="Alpha compositing"
			description="Curva de contraste a través de todos los niveles de opacidad y el alpha mínimo para pasar AA en la condición actual."
		>
			<div class="module-copy">
				<div>
					<span class="micro-label">Alpha mínimo AA</span>
					<strong>{minimumAlpha !== null ? `${Math.round(minimumAlpha * 100)}%` : 'No alcanza AA'}</strong>
				</div>
				<div>
					<span class="micro-label">Foreground actual</span>
					<strong>{Math.round(foregroundAlpha * 100)}%</strong>
				</div>
			</div>
			<ContrastGraph points={alphaSamples} threshold={4.5} minAlpha={minimumAlpha} />
		</SectionCard>

		<SectionCard
			eyebrow="Module"
			title="Generador de modo oscuro"
			description="Convierte el par visible actual a una versión oscura equivalente usando OKLCH y búsqueda del ratio objetivo."
		>
			{#if darkModePair}
				<div class="darkmode-card">
					<div class="darkmode-preview">
						<div class="darkmode-bg" style={`background:${rgbaToCss(darkModePair.background)}`}></div>
						<div class="darkmode-fg" style={`background:${rgbaToCss(darkModePair.foreground)}`}></div>
					</div>
					<div class="darkmode-meta">
						<div>
							<span class="micro-label">Background dark</span>
							<strong>{rgbaToHex(darkModePair.background)}</strong>
							<p>{rgbaToOklchString(darkModePair.background)}</p>
						</div>
						<div>
							<span class="micro-label">Foreground dark</span>
							<strong>{rgbaToHex(darkModePair.foreground)}</strong>
							<p>{rgbaToOklchString(darkModePair.foreground)}</p>
						</div>
						<div class="chips">
							<button type="button" class="chip" on:click={() => copyText('Foreground dark', rgbaToHex(darkModePair.foreground))}>Copiar FG</button>
							<button type="button" class="chip" on:click={() => copyText('Background dark', rgbaToHex(darkModePair.background))}>Copiar BG</button>
						</div>
					</div>
				</div>

				<div class="metric-grid compact">
					<MetricCard label="Objetivo" value={`${ratio.toFixed(2)}:1`} detail="Ratio visible actual" tone="default" />
					<MetricCard label="Dark ratio" value={`${darkModePair.ratio.toFixed(2)}:1`} detail="Resultado ajustado" tone={darkModePair.ratio >= ratio ? 'success' : 'warning'} />
					<MetricCard label="Dark APCA" value={`${Math.abs(darkModePair.apca).toFixed(1)} Lc`} detail="Percepción del par oscuro" tone={Math.abs(darkModePair.apca) >= 60 ? 'success' : 'warning'} />
				</div>
			{/if}
		</SectionCard>

		<SectionCard
			eyebrow="Module"
			title="Simulador de luz exterior"
			description="Estimación del contraste real bajo cinco escenarios de ambiente sobre una pantalla autoiluminada."
		>
			<div class="scenario-grid">
				{#each outdoorScenarios as scenario}
					<article class="scenario">
						<div class="scenario-swatch">
							<div style={`background:${scenario.background}`}></div>
							<div style={`background:${scenario.foreground}`}></div>
						</div>
						<strong>{scenario.condition.label}</strong>
						<p>{scenario.condition.description}</p>
						<span>{scenario.ratio.toFixed(2)}:1 · {Math.abs(scenario.apca).toFixed(1)} Lc</span>
					</article>
				{/each}
			</div>
		</SectionCard>

		<SectionCard
			eyebrow="Module"
			title="Fatiga visual"
			description="Detecta contraste insuficiente o excesivo y ubica el par dentro de la zona recomendada de 7:1 a 13:1."
		>
			<div class="fatigue-card">
				<div class="spectrum">
					<div class="band low"></div>
					<div class="band mid"></div>
					<div class="band opt"></div>
					<div class="band high"></div>
					<div class="needle" style={`left:${fatiguePosition}%`}></div>
				</div>
				<div class="module-copy">
					<div>
						<span class="micro-label">Estado</span>
						<strong>{fatigue.label}</strong>
					</div>
					<div>
						<span class="micro-label">Rango óptimo</span>
						<strong>7:1–13:1</strong>
					</div>
				</div>
				<p class="support-copy">{fatigue.description} Útil para evaluar confort de lectura, dislexia y sensibilidad visual.</p>
			</div>
		</SectionCard>

		<SectionCard
			eyebrow="Module"
			title="Contraste semántico"
			description="Comprueba que error, éxito, advertencia e info sigan siendo distinguibles entre sí bajo distintas condiciones de visión."
		>
			<div class="semantic-inputs">
				<label><span>Error</span><input bind:value={semanticError} /></label>
				<label><span>Éxito</span><input bind:value={semanticSuccess} /></label>
				<label><span>Advertencia</span><input bind:value={semanticWarning} /></label>
				<label><span>Info</span><input bind:value={semanticInfo} /></label>
			</div>

			<div class="semantic-summary-grid">
				{#each semanticConditionSummaries as summary}
					<article class:selected={summary.condition.id === selectedVision} class="semantic-summary">
						<strong>{summary.condition.label}</strong>
						<p>{summary.clear} claras · {summary.borderline} frontera · {summary.risky} riesgosas</p>
					</article>
				{/each}
			</div>

			{#if currentSemanticSummary}
				<div class="semantic-table">
					{#each currentSemanticSummary.scores as score}
						<div class={`semantic-row ${toneClass(score.status)}`}>
							<strong>{score.a} vs {score.b}</strong>
							<span>ΔOKLab {score.delta.toFixed(3)}</span>
							<span>{score.ratio.toFixed(2)}:1</span>
							<em>{colorDistanceDescription(score.delta)}</em>
						</div>
					{/each}
				</div>
			{/if}
		</SectionCard>

		<SectionCard
			eyebrow="Module"
			title="Simulador de impresión"
			description="Compara cómo cambia el contraste al pasar de pantalla a láser B&N, inkjet B&N, CMYK y papel periódico."
		>
			<div class="scenario-grid">
				{#each printScenarios as scenario}
					<article class="scenario">
						<div class="scenario-swatch">
							<div style={`background:${scenario.background}`}></div>
							<div style={`background:${scenario.foreground}`}></div>
						</div>
						<strong>{scenario.mode.label}</strong>
						<p>{scenario.mode.description}</p>
						<span>{scenario.ratio.toFixed(2)}:1</span>
					</article>
				{/each}
			</div>
		</SectionCard>
	</div>

	<section class="palette-area" id="palette">
		<SectionCard
			eyebrow="Palette"
			title="Generador perceptual de 12 pasos"
			description="Toma un color base y crea escalas light/dark en OKLCH, con usos semánticos, contraste contra blanco y negro y exportación lista para tokens."
		>
			<div class="palette-controls">
				<label>
					<span>Color base</span>
					<input
						type="text"
						value={paletteInput}
						on:input={(event) => setColorInput('palette', (event.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<label>
					<span>Nombre token</span>
					<input type="text" bind:value={paletteName} />
				</label>
				<div class="palette-chip">
					<span>Base</span>
					<strong>{paletteParsed.ok ? rgbaToOklchString(paletteParsed.color) : 'Color inválido'}</strong>
				</div>
			</div>

			<div class="palette-stack">
				<PaletteStrip
					title="Escala"
					theme="light"
					tones={palette.light}
					selectedStep={selectedLightStep}
					on:select={(event) => (selectedLightStep = event.detail)}
				/>
				{#if selectedLightTone}
					<div class="tone-detail">
						<div class="tone-swatch" style={`background:${selectedLightTone.hex}`}></div>
						<div>
							<span class="micro-label">Light step {selectedLightTone.step}</span>
							<strong>{selectedLightTone.label}</strong>
							<p>{selectedLightTone.hex} · {selectedLightTone.oklch}</p>
						</div>
						<div class="tone-ratios">
							<span>on white {selectedLightTone.contrastOnWhite.toFixed(2)}:1</span>
							<span>on black {selectedLightTone.contrastOnBlack.toFixed(2)}:1</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="palette-stack">
				<PaletteStrip
					title="Escala"
					theme="dark"
					tones={palette.dark}
					selectedStep={selectedDarkStep}
					on:select={(event) => (selectedDarkStep = event.detail)}
				/>
				{#if selectedDarkTone}
					<div class="tone-detail">
						<div class="tone-swatch" style={`background:${selectedDarkTone.hex}`}></div>
						<div>
							<span class="micro-label">Dark step {selectedDarkTone.step}</span>
							<strong>{selectedDarkTone.label}</strong>
							<p>{selectedDarkTone.hex} · {selectedDarkTone.oklch}</p>
						</div>
						<div class="tone-ratios">
							<span>on white {selectedDarkTone.contrastOnWhite.toFixed(2)}:1</span>
							<span>on black {selectedDarkTone.contrastOnBlack.toFixed(2)}:1</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="recommendations">
				<div>
					<span class="micro-label">Guía de uso</span>
					<p>
						Pasos 1-3 para fondos, 4-6 para UI y bordes, 7-9 para sólidos y CTA, 10-12 para texto y contraste
						alto.
					</p>
				</div>
				<div class="recommended-grid">
					{#each recommendedPalettePairs as pair}
						<article class="recommended-pair">
							<div class="recommended-preview" style={`background:${pair.background.hex}; color:${pair.foreground.hex}; border-color:${pair.foreground.hex}`}>
								Aa
							</div>
							<div>
								<strong>{pair.label}</strong>
								<p>{pair.ratio.toFixed(2)}:1 · {pair.apca.toFixed(1)} Lc</p>
							</div>
						</article>
					{/each}
				</div>
			</div>

			<div class="export-grid">
				<article class="export-card">
					<div class="export-head">
						<strong>CSS custom properties</strong>
						<button type="button" class="chip" on:click={() => copyText('CSS variables', cssExport)}>Copiar</button>
					</div>
					<pre>{cssExport}</pre>
				</article>

				<article class="export-card">
					<div class="export-head">
						<strong>Tailwind config</strong>
						<button type="button" class="chip" on:click={() => copyText('Tailwind config', tailwindExport)}>Copiar</button>
					</div>
					<pre>{tailwindExport}</pre>
				</article>

				<article class="export-card">
					<div class="export-head">
						<strong>W3C DTCG</strong>
						<button type="button" class="chip" on:click={() => copyText('Design tokens', dtcgExport)}>Copiar</button>
					</div>
					<pre>{dtcgExport}</pre>
				</article>
			</div>
		</SectionCard>
	</section>
</div>

<style>
	:global(h1, h2, h3) {
		font-family: 'Fraunces', Georgia, serif;
		letter-spacing: -0.03em;
	}

	.page {
		width: min(1440px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 2rem 0 4rem;
		position: relative;
		z-index: 1;
	}

	.hero {
		display: grid;
		grid-template-columns: 1.15fr 0.95fr;
		gap: 1.5rem;
		align-items: stretch;
		margin-bottom: 1.3rem;
	}

	.hero-copy,
	.hero-panel {
		border-radius: 32px;
		border: 1px solid var(--line);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 22%),
			rgba(15, 23, 42, 0.7);
		backdrop-filter: blur(18px);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
	}

	.badge,
	.micro-label {
		margin: 0;
		font-size: 0.76rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h1 {
		margin: 0.9rem 0 0.85rem;
		font-size: clamp(2.8rem, 7vw, 5.6rem);
		line-height: 0.96;
		max-width: 11ch;
	}

	.lede {
		max-width: 60ch;
		margin: 0;
		color: var(--ink-soft);
		font-size: 1.03rem;
		line-height: 1.7;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-top: 1.35rem;
	}

	.hero-actions a,
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.8rem 1rem;
		text-decoration: none;
		background: rgba(255, 255, 255, 0.05);
	}

	.hero-panel {
		display: grid;
		gap: 1rem;
	}

	.hero-chip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: baseline;
	}

	.hero-chip span {
		color: var(--ink-soft);
	}

	.hero-demo {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 1rem;
		min-height: 18rem;
	}

	.card {
		border-radius: 28px;
		border: 1px solid var(--bd);
		padding: 1.2rem;
		background: var(--bg);
		color: var(--fg);
	}

	.card p,
	.card span {
		margin: 0;
	}

	.headline {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0.55rem;
	}

	.headline h2 {
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 2.8rem);
	}

	.stat {
		display: grid;
		align-content: space-between;
	}

	.stat strong {
		font-size: clamp(2rem, 6vw, 3.6rem);
		font-weight: 700;
		line-height: 0.95;
	}

	.control-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: end;
		padding: 1rem 1.15rem;
		margin-bottom: 1.2rem;
		border: 1px solid var(--line);
		border-radius: 24px;
		background: rgba(2, 6, 23, 0.54);
		backdrop-filter: blur(16px);
	}

	.control-bar label,
	.palette-controls label,
	.semantic-inputs label {
		display: grid;
		gap: 0.5rem;
		min-width: 13rem;
	}

	.control-bar span,
	.palette-controls span,
	.semantic-inputs span {
		color: var(--ink-soft);
		font-size: 0.84rem;
	}

	select,
	.palette-controls input,
	.semantic-inputs input {
		border: 1px solid var(--line-strong);
		border-radius: 16px;
		padding: 0.85rem 0.95rem;
		background: rgba(2, 6, 23, 0.7);
		color: var(--ink-strong);
	}

	.main-grid,
	.module-grid {
		display: grid;
		gap: 1.2rem;
	}

	.main-grid {
		grid-template-columns: 1.05fr 0.95fr;
	}

	.module-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 1.2rem;
	}

	.stack,
	.palette-stack {
		display: grid;
		gap: 1.2rem;
	}

	.color-grid,
	.metric-grid {
		display: grid;
		gap: 0.9rem;
	}

	.color-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.metric-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.metric-grid.compact {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.preset-row,
	.recommendations,
	.darkmode-card,
	.effective-pair {
		display: grid;
		gap: 1rem;
	}

	.preset-row {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 1rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.chip {
		color: var(--ink-strong);
	}

	.chip.ghost {
		background: rgba(2, 6, 23, 0.68);
	}

	.empty,
	.support-copy {
		color: var(--ink-soft);
		line-height: 1.55;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.preview-card {
		min-height: 14rem;
		padding: 1rem;
		border: 1px solid var(--preview-border);
		border-radius: 24px;
		background: var(--preview-bg);
		color: var(--preview-fg);
	}

	.preview-kicker {
		display: inline-flex;
		margin-bottom: 0.9rem;
		padding: 0.4rem 0.65rem;
		border-radius: 999px;
		background: var(--preview-soft);
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.typography h3,
	.typography p,
	.alert-box p,
	.preview-card strong,
	.preview-card span,
	.preview-card label,
	.preview-card a,
	.preview-card td,
	.preview-card th {
		color: inherit;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
	}

	.preview-button {
		border-radius: 999px;
		padding: 0.82rem 1.05rem;
	}

	.preview-button.filled {
		border: 1px solid transparent;
		background: var(--preview-fg);
		color: var(--preview-bg);
	}

	.preview-button.outline {
		border: 1px solid var(--preview-border);
		background: transparent;
		color: var(--preview-fg);
	}

	.forms input {
		width: 100%;
		margin-top: 0.4rem;
		border: 1px solid var(--preview-border);
		background: var(--preview-soft);
		color: var(--preview-fg);
		padding: 0.75rem 0.9rem;
		border-radius: 14px;
	}

	.nav nav {
		display: flex;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.nav a {
		padding-bottom: 0.3rem;
		border-bottom: 1px solid transparent;
	}

	.nav .active {
		border-color: currentColor;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--preview-border);
		text-align: left;
	}

	.alert-box {
		margin-top: 0.4rem;
		padding: 1rem;
		border-radius: 18px;
		border: 1px solid var(--preview-border);
		background: linear-gradient(135deg, rgba(255, 138, 61, 0.18), transparent 72%), var(--preview-soft);
	}

	.criterion-list,
	.semantic-table,
	.scenario-grid,
	.export-grid,
	.semantic-summary-grid,
	.recommended-grid {
		display: grid;
		gap: 0.8rem;
	}

	.criterion-list {
		margin-top: 1rem;
	}

	.criterion {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		background: rgba(2, 6, 23, 0.44);
		border: 1px solid rgba(251, 113, 133, 0.18);
	}

	.criterion.itemPass {
		border-color: rgba(132, 204, 22, 0.24);
	}

	.criterion p,
	.criterion em {
		margin: 0.28rem 0 0;
		color: var(--ink-soft);
	}

	.criterion-metrics {
		text-align: right;
	}

	.effective-pair {
		grid-template-columns: auto 1fr;
		align-items: center;
	}

	.effective-swatch {
		position: relative;
		width: 10rem;
		height: 10rem;
		border-radius: 32px;
		overflow: hidden;
		border: 1px solid var(--line);
	}

	.effective-swatch .bg,
	.effective-swatch .fg {
		position: absolute;
	}

	.effective-swatch .bg {
		inset: 0;
	}

	.effective-swatch .fg {
		inset: 22% 22% auto auto;
		width: 42%;
		height: 42%;
		border-radius: 22px;
		border: 1px solid rgba(255, 255, 255, 0.22);
	}

	.effective-meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.effective-meta strong,
	.module-copy strong,
	.tone-detail strong,
	.darkmode-meta strong,
	.palette-chip strong {
		display: block;
		margin-top: 0.25rem;
		font-size: 1.1rem;
	}

	.effective-meta p,
	.darkmode-meta p,
	.tone-detail p {
		margin: 0.35rem 0 0;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.module-copy {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
		margin-bottom: 1rem;
	}

	.darkmode-card {
		grid-template-columns: auto 1fr;
		align-items: stretch;
	}

	.darkmode-preview {
		position: relative;
		width: 12rem;
		border-radius: 28px;
		overflow: hidden;
		border: 1px solid var(--line);
		background: rgba(2, 6, 23, 0.6);
	}

	.darkmode-bg,
	.darkmode-fg {
		position: absolute;
		border-radius: 22px;
	}

	.darkmode-bg {
		inset: 0;
	}

	.darkmode-fg {
		inset: 20% 18% 18% 20%;
		border: 1px solid rgba(255, 255, 255, 0.18);
	}

	.darkmode-meta {
		display: grid;
		gap: 1rem;
	}

	.scenario-grid,
	.semantic-summary-grid,
	.recommended-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.scenario,
	.semantic-summary,
	.recommended-pair,
	.tone-detail,
	.palette-chip {
		padding: 0.95rem;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: rgba(2, 6, 23, 0.46);
	}

	.scenario-swatch {
		position: relative;
		height: 5.5rem;
		margin-bottom: 0.8rem;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.scenario-swatch div:first-child,
	.scenario-swatch div:last-child {
		position: absolute;
	}

	.scenario-swatch div:first-child {
		inset: 0;
	}

	.scenario-swatch div:last-child {
		inset: 20% 20% auto auto;
		width: 42%;
		height: 42%;
		border-radius: 18px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.scenario p,
	.semantic-summary p,
	.recommended-pair p {
		margin: 0.35rem 0 0;
		color: var(--ink-soft);
		line-height: 1.55;
	}

	.spectrum {
		position: relative;
		display: grid;
		grid-template-columns: 1.1fr 1fr 1.1fr 1fr;
		height: 1.2rem;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--line);
	}

	.band.low {
		background: linear-gradient(90deg, rgba(251, 113, 133, 0.9), rgba(255, 138, 61, 0.9));
	}

	.band.mid {
		background: linear-gradient(90deg, rgba(255, 138, 61, 0.9), rgba(250, 204, 21, 0.86));
	}

	.band.opt {
		background: linear-gradient(90deg, rgba(132, 204, 22, 0.9), rgba(34, 197, 94, 0.86));
	}

	.band.high {
		background: linear-gradient(90deg, rgba(34, 211, 238, 0.9), rgba(59, 130, 246, 0.9));
	}

	.needle {
		position: absolute;
		top: -0.2rem;
		transform: translateX(-50%);
		width: 0.85rem;
		height: 1.6rem;
		border-radius: 999px;
		background: white;
		box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.14);
	}

	.semantic-inputs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.semantic-summary.selected {
		border-color: rgba(255, 138, 61, 0.35);
		box-shadow: inset 0 0 0 1px rgba(255, 138, 61, 0.12);
	}

	.semantic-row {
		display: grid;
		grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
		padding: 0.8rem 0.95rem;
		border-radius: 16px;
		background: rgba(2, 6, 23, 0.44);
		border: 1px solid var(--line);
	}

	.semantic-row.good {
		border-color: rgba(132, 204, 22, 0.26);
	}

	.semantic-row.warn {
		border-color: rgba(255, 138, 61, 0.26);
	}

	.semantic-row.bad {
		border-color: rgba(251, 113, 133, 0.24);
	}

	.palette-area {
		margin-top: 1.2rem;
	}

	.palette-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.7fr) auto;
		gap: 0.9rem;
		margin-bottom: 1rem;
		align-items: end;
	}

	.palette-chip {
		min-width: 16rem;
	}

	.tone-detail,
	.recommendations {
		grid-template-columns: auto 1fr auto;
		align-items: center;
	}

	.tone-swatch,
	.recommended-preview {
		width: 4.2rem;
		height: 4.2rem;
		border-radius: 18px;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.tone-ratios {
		display: grid;
		gap: 0.35rem;
		color: var(--ink-soft);
		font-size: 0.9rem;
	}

	.recommendations {
		margin: 1rem 0;
		align-items: start;
	}

	.recommended-pair {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.8rem;
		align-items: center;
	}

	.recommended-preview {
		display: grid;
		place-items: center;
		font-size: 1.3rem;
		font-weight: 700;
		border-width: 1px;
		border-style: solid;
	}

	.export-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.export-card {
		border-radius: 24px;
		border: 1px solid var(--line);
		background: rgba(2, 6, 23, 0.5);
		overflow: hidden;
	}

	.export-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}

	pre {
		margin: 0;
		padding: 1rem;
		overflow: auto;
		font-size: 0.8rem;
		line-height: 1.65;
		color: #cbd5e1;
	}

	.copied {
		margin-left: auto;
		color: var(--lime);
		font-size: 0.92rem;
	}

	@media (max-width: 1200px) {
		.hero,
		.main-grid,
		.module-grid {
			grid-template-columns: 1fr;
		}

		.color-grid,
		.preview-grid,
		.export-grid,
		.semantic-inputs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.palette-controls,
		.recommendations,
		.tone-detail {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
		.page {
			width: min(100% - 1rem, 1440px);
			padding-top: 1rem;
		}

		.hero-demo,
		.metric-grid,
		.metric-grid.compact,
		.preset-row,
		.scenario-grid,
		.semantic-summary-grid,
		.recommended-grid,
		.effective-meta,
		.module-copy,
		.semantic-row,
		.preview-grid,
		.color-grid,
		.export-grid,
		.semantic-inputs {
			grid-template-columns: 1fr;
		}

		.darkmode-card,
		.effective-pair {
			grid-template-columns: 1fr;
		}

		.effective-swatch,
		.darkmode-preview {
			width: 100%;
			height: 12rem;
		}
	}
</style>
