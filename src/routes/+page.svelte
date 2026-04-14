<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import ColorField from '$lib/components/ColorField.svelte';
	import ContrastGraph from '$lib/components/ContrastGraph.svelte';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import PaletteStrip from '$lib/components/PaletteStrip.svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
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

	type WorkspaceTab = 'checker' | 'simulations' | 'palette';
	type ThemeMode = 'light' | 'dark';

	const workspaceTabs: { id: WorkspaceTab; label: string; summary: string }[] = [
		{ id: 'checker', label: 'Checker', summary: 'Composición, ratio y aprobación' },
		{ id: 'simulations', label: 'Simulaciones', summary: 'Contexto real, visión y semántica' },
		{ id: 'palette', label: 'Paleta', summary: 'Escala, tokens y exportación' }
	];

	let activeTab: WorkspaceTab = 'checker';
	let theme: ThemeMode = 'light';
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
	const THEME_STORAGE_KEY = 'chromacheck-theme';

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
		activeTab = 'checker';
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

		if (browser) {
			const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
			if (storedTheme === 'light' || storedTheme === 'dark') {
				theme = storedTheme;
			}
			document.documentElement.dataset.theme = theme;
		}

		return () => {
			if (saveTimer) clearTimeout(saveTimer);
		};
	});

	function setTheme(next: ThemeMode) {
		theme = next;
		if (browser) {
			document.documentElement.dataset.theme = next;
			localStorage.setItem(THEME_STORAGE_KEY, next);
		}
	}

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
	$: passedCount = criteria.filter((item) => item.passed).length;
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

	$: currentVision = VISION_CONDITIONS.find((item) => item.id === selectedVision) ?? VISION_CONDITIONS[0];
	$: currentAmbient = AMBIENT_CONDITIONS.find((item) => item.id === selectedAmbient) ?? AMBIENT_CONDITIONS[0];
	$: currentPrint = PRINT_MODES.find((item) => item.id === selectedPrint) ?? PRINT_MODES[0];

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
	<header class="masthead">
		<div class="brandline">
			<div class="brand-block">
				<p class="badge">ChromaCheck</p>
				<span>Contrast intelligence workspace</span>
			</div>
			<div class="theme-toggle" role="tablist" aria-label="Tema visual">
				<button type="button" class:active={theme === 'light'} on:click={() => setTheme('light')}>Light</button>
				<button type="button" class:active={theme === 'dark'} on:click={() => setTheme('dark')}>Dark</button>
			</div>
		</div>

		<div class="masthead-grid">
			<div class="masthead-copy">
				<p class="section-label">Simple, visual, production-ready</p>
				<h1>Una herramienta de contraste mucho más clara y fácil de usar.</h1>
				<p class="lede">
					Reordena el flujo, da contexto real a los resultados y convierte la evaluación de color en una tarea
					rápida, visual e intuitiva para diseño y producto.
				</p>

				<div class="hero-points">
					<span>Resultados explicados</span>
					<span>Selector visual mejorado</span>
					<span>Light + dark mode</span>
				</div>

				<div class="hero-actions">
					<button type="button" class="primary" on:click={() => (activeTab = 'checker')}>Abrir checker</button>
					<button type="button" class="secondary" on:click={() => (activeTab = 'palette')}>Abrir paleta</button>
				</div>
			</div>

			<aside class="masthead-monitor">
				<div class="monitor-meta">
					<div>
						<span class="subtle-label">Sesión activa</span>
						<strong>{currentVision.label} · {currentAmbient.label} · {currentPrint.label}</strong>
					</div>
					<div class="monitor-pills">
						<span>{passedCount}/11 aprobados</span>
						<span>{Math.abs(apca).toFixed(1)} Lc</span>
					</div>
				</div>

				<div class="monitor-stage" style={`--monitor-fg:${previewForeground}; --monitor-bg:${previewBackground}; --monitor-border:${previewBorder}; --monitor-soft:${previewSoft};`}>
					<div class="monitor-editor">
						<p>Live preview</p>
						<h2>Readable by design</h2>
						<span>El color visible ya incorpora alpha y simulación</span>
					</div>

					<div class="monitor-figures">
						<article>
							<span>WCAG</span>
							<strong>{ratio.toFixed(2)}:1</strong>
						</article>
						<article>
							<span>APCA</span>
							<strong>{Math.abs(apca).toFixed(1)} Lc</strong>
						</article>
						<article>
							<span>Estado</span>
							<strong>{fatigue.label}</strong>
						</article>
					</div>
				</div>
			</aside>
		</div>
	</header>

	<section class="workspace-shell">
		<div class="workspace-top">
			<div class="tablist" role="tablist" aria-label="Secciones principales">
				{#each workspaceTabs as tab}
					<button
						type="button"
						role="tab"
						class:active={activeTab === tab.id}
						aria-selected={activeTab === tab.id}
						on:click={() => (activeTab = tab.id)}
					>
						<strong>{tab.label}</strong>
						<span>{tab.summary}</span>
					</button>
				{/each}
			</div>

			<div class="workspace-status">
				<div>
					<span class="subtle-label">Foreground</span>
					<strong>{foregroundColor ? rgbaToHex(foregroundColor) : '—'}</strong>
				</div>
				<div>
					<span class="subtle-label">Background</span>
					<strong>{backgroundColor ? rgbaToHex(backgroundColor) : '—'}</strong>
				</div>
				<div>
					<span class="subtle-label">Resumen</span>
					<strong>{criteriaSummary}</strong>
				</div>
			</div>
		</div>

		<div class="workspace-controls">
			<label>
				<span class="label-inline">Visión <Tooltip content="Simula cómo cambian los colores y su separación perceptual bajo distintas condiciones visuales." label="Info sobre visión" /></span>
				<select bind:value={selectedVision}>
					{#each VISION_CONDITIONS as condition}
						<option value={condition.id}>{condition.label}</option>
					{/each}
				</select>
			</label>

			<label>
				<span class="label-inline">Luz ambiental <Tooltip content="Modela el efecto del brillo ambiente y la pérdida de contraste en pantalla." label="Info sobre luz ambiental" /></span>
				<select bind:value={selectedAmbient}>
					{#each AMBIENT_CONDITIONS as condition}
						<option value={condition.id}>{condition.label}</option>
					{/each}
				</select>
			</label>

			<label>
				<span class="label-inline">Salida <Tooltip content="Cambia entre pantalla e impresión para estimar cómo se modifica el contraste final." label="Info sobre salida" /></span>
				<select bind:value={selectedPrint}>
					{#each PRINT_MODES as mode}
						<option value={mode.id}>{mode.label}</option>
					{/each}
				</select>
			</label>

			<div class="pair-card">
				<div class="pair-swatches">
					<span style={`background:${foregroundColor ? rgbaToCss(foregroundColor) : '#0f172a'}`}></span>
					<span style={`background:${backgroundColor ? rgbaToCss(backgroundColor) : '#f8fafc'}`}></span>
					<span style={`background:${surfaceColor ? rgbaToCss(surfaceColor) : '#ffffff'}`}></span>
				</div>
				<div>
					<span>Par activo</span>
					<strong>{foregroundInput} / {backgroundInput}</strong>
					<p>Surface {surfaceInput}</p>
				</div>
			</div>
		</div>
	</section>

	{#if copied}
		<div class="copied">{copied}</div>
	{/if}

	{#if activeTab === 'checker'}
		<section class="tab-panel" role="tabpanel" id="checker">
			<div class="checker-grid">
				<SectionCard
					eyebrow="Composer"
					title="Capas y composición real"
					description="Todo empieza con tres capas claras. Define foreground, background y surface, y deja que ChromaCheck resuelva la visibilidad efectiva."
				>
					<div class="composer-grid">
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
							onchange={(val) => setColorInput('foreground', val)}
							onalpha={(val) => (foregroundAlpha = val)}
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
							onchange={(val) => setColorInput('background', val)}
							onalpha={(val) => (backgroundAlpha = val)}
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
							onchange={(val) => setColorInput('surface', val)}
							onalpha={(val) => (surfaceAlpha = val)}
						/>
					</div>

					<div class="toolbar-row">
						<div class="toolbar-block">
							<span class="subtle-label">Presets</span>
							<div class="chips">
								{#each PRESET_PAIRS as preset}
									<button type="button" class="chip" on:click={() => applyPreset(preset)}>{preset.name}</button>
								{/each}
							</div>
						</div>

						<div class="toolbar-block">
							<span class="subtle-label">Historial</span>
							<div class="chips">
								{#if history.length}
									{#each history as entry}
										<button type="button" class="chip ghost" on:click={() => loadFromHistory(entry)}>
											{entry.fg} / {entry.bg}
										</button>
									{/each}
								{:else}
									<span class="empty">Tus últimos 8 pares válidos aparecerán aquí.</span>
								{/if}
							</div>
						</div>
					</div>
				</SectionCard>

				<SectionCard
					eyebrow="Audit"
					title="Lectura inmediata del contraste"
					description="La auditoría principal concentra el resultado visible, la aprobación por criterio y una muestra viva del par final."
				>
					<div class="audit-overview">
						<div class="audit-hero">
							<div class="audit-ratio">
								<span class="subtle-label">Ratio visible</span>
								<strong>{ratio.toFixed(2)}:1</strong>
								<p>{Math.abs(apca).toFixed(1)} Lc · {polarityLabel(apca)}</p>
							</div>

							<div class="audit-preview" style={`--preview-fg:${previewForeground}; --preview-bg:${previewBackground}; --preview-border:${previewBorder}; --preview-soft:${previewSoft};`}>
								<div class="preview-heading">
									<span>Context sample</span>
									<strong>{currentVision.label}</strong>
								</div>
								<div class="preview-surface">
									<p>Body copy</p>
									<h3>Readable by default</h3>
									<span>Preview sobre color visible compuesto</span>
								</div>
							</div>
						</div>

						<div class="metric-grid">
							<MetricCard
								label="WCAG ratio"
								value={ratio ? `${ratio.toFixed(2)}:1` : '—'}
								detail="Relación final de luminancia"
								tone={ratio >= 7 ? 'success' : ratio >= 4.5 ? 'warning' : 'danger'}
								hint="WCAG compara luminancia relativa. Úsalo para validar AA y AAA en texto, UI e iconografía."
							/>
							<MetricCard
								label="APCA"
								value={analysisReady ? `${Math.abs(apca).toFixed(1)} Lc` : '—'}
								detail={analysisReady ? polarityLabel(apca) : '—'}
								tone={Math.abs(apca) >= 75 ? 'success' : Math.abs(apca) >= 60 ? 'warning' : 'danger'}
								hint="APCA mide contraste perceptual. Es especialmente útil para lectura real y jerarquía visual."
							/>
							<MetricCard
								label="Criterios"
								value={criteriaSummary}
								detail="Aprobados sobre 11 checks"
								tone={metricTone(criteria)}
								hint="Este resumen combina WCAG 2.2 y tres umbrales APCA para darte una lectura más completa."
							/>
							<MetricCard
								label="Fatiga"
								value={fatigue.label}
								detail={fatigue.description}
								tone={fatigue.tone === 'optimal' ? 'success' : fatigue.tone === 'moderate' ? 'warning' : 'danger'}
								hint="No todo contraste alto es cómodo. Este módulo ayuda a detectar lectura cansada o agresiva."
							/>
						</div>
					</div>

					<div class="criterion-list compact">
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
			</div>

			<div class="checker-secondary">
				<SectionCard
					eyebrow="Preview"
					title="Visualizador contextual"
					description="Los colores activos se aplican a componentes UI reales para que el usuario lea el contraste en contexto, no sólo como un número."
				>
					<div class="preview-grid" style={`--preview-fg:${previewForeground}; --preview-bg:${previewBackground}; --preview-border:${previewBorder}; --preview-soft:${previewSoft};`}>
						<article class="preview-card typography">
							<span class="preview-kicker">Tipografía</span>
							<h3>Readable by design</h3>
							<p>
								El preview usa el par compuesto final y permite detectar si la lectura se mantiene elegante,
								nítida y descansada.
							</p>
						</article>

						<article class="preview-card buttons">
							<span class="preview-kicker">Botones</span>
							<div class="button-row">
								<button type="button" class="preview-button filled">Primary action</button>
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
								<thead>
									<tr><th>Token</th><th>Ratio</th></tr>
								</thead>
								<tbody>
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

				<div class="stack">
					<SectionCard
						eyebrow="Module"
						title="Alpha compositing"
						description="Una curva sobria y legible para entender cuánto contraste gana o pierde el foreground al variar la opacidad."
					>
						<div class="module-copy">
							<div>
								<span class="subtle-label">Alpha mínimo AA</span>
								<strong>{minimumAlpha !== null ? `${Math.round(minimumAlpha * 100)}%` : 'No alcanza AA'}</strong>
							</div>
							<div>
								<span class="subtle-label">Foreground actual</span>
								<strong>{Math.round(foregroundAlpha * 100)}%</strong>
							</div>
						</div>
						<ContrastGraph points={alphaSamples} threshold={4.5} minAlpha={minimumAlpha} />
					</SectionCard>

					<SectionCard
						eyebrow="Signals"
						title="Capas efectivas"
						description="Éste es el par realmente visible después de resolver composición, visión simulada, luz y salida."
					>
						<div class="effective-pair">
							<div class="effective-swatch">
								<div class="bg" style={`background:${previewBackground}`}></div>
								<div class="fg" style={`background:${previewForeground}`}></div>
							</div>
							<div class="effective-meta">
								<div>
									<span class="subtle-label">Foreground visible</span>
									<strong>{pipeline ? rgbaToHex(pipeline.foreground) : '—'}</strong>
									<p>{pipeline ? rgbaToOklchString(pipeline.foreground) : '—'}</p>
								</div>
								<div>
									<span class="subtle-label">Background visible</span>
									<strong>{pipeline ? rgbaToHex(pipeline.background) : '—'}</strong>
									<p>{pipeline ? rgbaToOklchString(pipeline.background) : '—'}</p>
								</div>
							</div>
						</div>
						<div class="chips">
							<button
								type="button"
								class="chip"
								on:click={() =>
									copyText(
										'Foreground visible',
										pipeline ? rgbaToHex(pipeline.foreground) : ''
									)}
							>
								Copiar FG visible
							</button>
							<button
								type="button"
								class="chip"
								on:click={() =>
									copyText(
										'Background visible',
										pipeline ? rgbaToHex(pipeline.background) : ''
									)}
							>
								Copiar BG visible
							</button>
						</div>
					</SectionCard>
				</div>
			</div>
		</section>
	{:else if activeTab === 'simulations'}
		<section class="tab-panel" role="tabpanel">
			<div class="simulation-top">
				<SectionCard
					eyebrow="Context"
					title="Simulación visual en componentes reales"
					description="Un tablero más visual para leer cómo se comporta el color en tipografía, botones, formularios, navegación, tablas y alertas."
				>
					<div class="preview-grid" style={`--preview-fg:${previewForeground}; --preview-bg:${previewBackground}; --preview-border:${previewBorder}; --preview-soft:${previewSoft};`}>
						<article class="preview-card typography">
							<span class="preview-kicker">Tipografía</span>
							<h3>Context is the real test</h3>
							<p>Las simulaciones aquí deben sentirse útiles y quietas, no ruidosas.</p>
						</article>

						<article class="preview-card buttons">
							<span class="preview-kicker">Botones</span>
							<div class="button-row">
								<button type="button" class="preview-button filled">Proceed</button>
								<button type="button" class="preview-button outline">Dismiss</button>
							</div>
						</article>

						<article class="preview-card forms">
							<span class="preview-kicker">Formularios</span>
							<label>
								<span>Project name</span>
								<input type="text" value="ChromaCheck" readonly />
							</label>
						</article>

						<article class="preview-card nav">
							<span class="preview-kicker">Navegación</span>
							<nav>
								<a class="active" href="#checker">Checker</a>
								<a href="#checker">Vision</a>
								<a href="#palette">Palette</a>
							</nav>
						</article>

						<article class="preview-card table">
							<span class="preview-kicker">Tablas</span>
							<table>
								<thead>
									<tr><th>Mode</th><th>Status</th></tr>
								</thead>
								<tbody>
									<tr><td>{currentPrint.label}</td><td>{criteriaSummary}</td></tr>
									<tr><td>{currentAmbient.label}</td><td>{fatigue.label}</td></tr>
								</tbody>
							</table>
						</article>

						<article class="preview-card alert">
							<span class="preview-kicker">Alertas</span>
							<div class="alert-box">
								<strong>Under visual simulation</strong>
								<p>Este preview refleja la condición activa en tiempo real.</p>
							</div>
						</article>
					</div>
				</SectionCard>

				<SectionCard
					eyebrow="Module"
					title="Generador de modo oscuro"
					description="Propone un equivalente oscuro conservando intención cromática y acercándose al ratio objetivo del par visible."
				>
					{#if darkModePair}
						<div class="darkmode-card">
							<div class="darkmode-preview">
								<div class="darkmode-bg" style={`background:${rgbaToCss(darkModePair.background)}`}></div>
								<div class="darkmode-fg" style={`background:${rgbaToCss(darkModePair.foreground)}`}></div>
							</div>
							<div class="darkmode-meta">
								<div>
									<span class="subtle-label">Background dark</span>
									<strong>{rgbaToHex(darkModePair.background)}</strong>
									<p>{rgbaToOklchString(darkModePair.background)}</p>
								</div>
								<div>
									<span class="subtle-label">Foreground dark</span>
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
							<MetricCard label="Objetivo" value={`${ratio.toFixed(2)}:1`} detail="Ratio visible actual" tone="default" hint="Éste es el objetivo que intentamos igualar al generar la versión dark." />
							<MetricCard label="Dark ratio" value={`${darkModePair.ratio.toFixed(2)}:1`} detail="Resultado ajustado" tone={darkModePair.ratio >= ratio ? 'success' : 'warning'} hint="Compara qué tan cerca queda el par oscuro del contraste original." />
							<MetricCard label="Dark APCA" value={`${Math.abs(darkModePair.apca).toFixed(1)} Lc`} detail="Percepción del par oscuro" tone={Math.abs(darkModePair.apca) >= 60 ? 'success' : 'warning'} hint="APCA ayuda a estimar si el modo oscuro conserva legibilidad perceptual." />
						</div>
					{/if}
				</SectionCard>
			</div>

			<div class="simulation-grid">
				<SectionCard
					eyebrow="Module"
					title="Luz exterior"
					description="Compara el contraste bajo cinco condiciones ambientales, desde estudio controlado hasta celular al sol."
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
					title="Simulador de impresión"
					description="Evalúa cómo cambia el contraste al pasar de pantalla a láser, inkjet, CMYK y papel periódico."
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

			<div class="simulation-grid">
				<SectionCard
					eyebrow="Module"
					title="Fatiga visual"
					description="El objetivo no es solo aprobar. También importa que el contraste se sienta cómodo, sereno y sostenible en lectura prolongada."
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
								<span class="subtle-label">Estado</span>
								<strong>{fatigue.label}</strong>
							</div>
							<div>
								<span class="subtle-label">Zona óptima</span>
								<strong>7:1–13:1</strong>
							</div>
						</div>
						<p class="support-copy">{fatigue.description} Especialmente útil al revisar confort de lectura y sensibilidad visual.</p>
					</div>
				</SectionCard>

				<SectionCard
					eyebrow="Signals"
					title="Capas visibles"
					description="Un resumen ejecutivo del par final que ve la persona usuaria bajo la condición activa."
				>
					<div class="effective-pair">
						<div class="effective-swatch">
							<div class="bg" style={`background:${previewBackground}`}></div>
							<div class="fg" style={`background:${previewForeground}`}></div>
						</div>
						<div class="effective-meta">
							<div>
								<span class="subtle-label">Foreground visible</span>
								<strong>{pipeline ? rgbaToHex(pipeline.foreground) : '—'}</strong>
								<p>{pipeline ? rgbaToOklchString(pipeline.foreground) : '—'}</p>
							</div>
							<div>
								<span class="subtle-label">Background visible</span>
								<strong>{pipeline ? rgbaToHex(pipeline.background) : '—'}</strong>
								<p>{pipeline ? rgbaToOklchString(pipeline.background) : '—'}</p>
							</div>
						</div>
					</div>
				</SectionCard>
			</div>

			<SectionCard
				eyebrow="Module"
				title="Contraste semántico"
				description="Revisa si error, éxito, advertencia e info siguen siendo distinguibles entre sí bajo diferentes condiciones de visión."
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
		</section>
	{:else}
		<section class="tab-panel" role="tabpanel" id="palette">
			<SectionCard
				eyebrow="Palette"
				title="Generador perceptual de 12 pasos"
				description="Una escala más editorial y utilizable: cada paso tiene un rol claro y una lectura inmediata contra blanco y negro."
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
						<span class="subtle-label">Base</span>
						<strong>{paletteParsed.ok ? rgbaToOklchString(paletteParsed.color) : 'Color inválido'}</strong>
					</div>
				</div>

				<div class="palette-stack">
					<PaletteStrip
						title="Escala"
						theme="light"
						tones={palette.light}
						selectedStep={selectedLightStep}
						onselect={(step) => (selectedLightStep = step)}
					/>
					{#if selectedLightTone}
						<div class="tone-detail">
							<div class="tone-swatch" style={`background:${selectedLightTone.hex}`}></div>
							<div>
								<span class="subtle-label">Light step {selectedLightTone.step}</span>
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
						onselect={(step) => (selectedDarkStep = step)}
					/>
					{#if selectedDarkTone}
						<div class="tone-detail">
							<div class="tone-swatch" style={`background:${selectedDarkTone.hex}`}></div>
							<div>
								<span class="subtle-label">Dark step {selectedDarkTone.step}</span>
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
						<span class="subtle-label">Guía de uso</span>
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
			</SectionCard>

			<SectionCard
				eyebrow="Export"
				title="Tokens listos para producción"
				description="La exportación conserva el tono premium del sistema, pero baja a artefactos prácticos para CSS, Tailwind y Design Tokens."
			>
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
	{/if}
</div>

<style>
	:global(h1, h2, h3) {
		font-family: 'Newsreader', Georgia, serif;
		letter-spacing: -0.035em;
		font-weight: 500;
	}

	.page {
		position: relative;
		z-index: 1;
		width: min(1460px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 1.6rem 0 4rem;
		display: grid;
		gap: 1rem;
	}

	.masthead,
	.workspace-shell {
		border: 1px solid var(--line);
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
			var(--surface-1);
		box-shadow: var(--shadow-lg);
		backdrop-filter: blur(16px);
	}

	.masthead {
		padding: 1.2rem 1.2rem 1.35rem;
	}

	.brandline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.brand-block {
		display: grid;
		gap: 0.25rem;
	}

	.badge,
	.section-label,
	.subtle-label {
		margin: 0;
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.brandline span,
	.lede,
	.empty,
	.support-copy,
	.criterion p,
	.criterion em,
	.effective-meta p,
	.darkmode-meta p,
	.scenario p,
	.semantic-summary p,
	.semantic-row em,
	.recommended-pair p,
	.tone-detail p,
	.preview-card p {
		color: var(--ink-soft);
	}

	.masthead-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(360px, 0.72fr);
		gap: 1rem;
		align-items: stretch;
	}

	.masthead-copy,
	.masthead-monitor {
		border: 1px solid var(--line);
		border-radius: 24px;
		background: var(--surface-2);
		padding: 1.5rem;
	}

	.masthead-copy h1 {
		margin: 0.75rem 0 0.9rem;
		max-width: 11ch;
		font-size: clamp(2.45rem, 5vw, 4.2rem);
		line-height: 0.95;
	}

	.lede {
		margin: 0;
		max-width: 60ch;
		font-size: 1.04rem;
		line-height: 1.72;
	}

	.hero-points {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1.2rem;
	}

	.hero-points span,
	.monitor-pills span,
	.chip,
	.workspace-status strong {
		border-radius: 999px;
		border: 1px solid var(--line);
		background: rgba(79, 110, 247, 0.05);
		padding: 0.62rem 0.85rem;
	}

	:global(html[data-theme='dark']) .hero-points span,
	:global(html[data-theme='dark']) .monitor-pills span,
	:global(html[data-theme='dark']) .chip,
	:global(html[data-theme='dark']) .workspace-status strong {
		background: rgba(124, 148, 255, 0.08);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-top: 1.35rem;
	}

	.hero-actions button {
		border-radius: 14px;
		padding: 0.88rem 1.15rem;
		font-weight: 600;
		box-shadow: var(--shadow-md);
	}

	.primary {
		border: 1px solid transparent;
		background: linear-gradient(180deg, #5e7cfa, #4f6ef7);
		color: white;
		box-shadow: var(--button-shadow);
	}

	.secondary {
		border: 1px solid var(--line-strong);
		background: rgba(255, 255, 255, 0.72);
		color: var(--ink-strong);
	}

	:global(html[data-theme='dark']) .secondary {
		background: rgba(255, 255, 255, 0.03);
	}

	.primary:hover,
	.secondary:hover,
	.primary:focus-visible,
	.secondary:focus-visible {
		transform: translateY(-1px);
		outline: none;
	}

	.secondary:focus-visible,
	.primary:focus-visible {
		box-shadow: 0 0 0 4px var(--accent-soft);
	}

	.theme-toggle {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface-3);
		box-shadow: var(--shadow-md);
	}

	.theme-toggle button {
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		padding: 0.58rem 0.88rem;
		border-radius: 999px;
		font-weight: 700;
	}

	.theme-toggle button.active {
		background: var(--accent);
		color: white;
		box-shadow: var(--button-shadow);
	}

	.masthead-monitor {
		display: grid;
		gap: 1rem;
	}

	.monitor-meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.monitor-meta strong {
		display: block;
		margin-top: 0.35rem;
		font-size: 1rem;
	}

	.monitor-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		justify-content: flex-end;
	}

	.monitor-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 14rem;
		gap: 0.9rem;
		--card-bg: var(--monitor-bg);
		--card-fg: var(--monitor-fg);
		--card-border: var(--monitor-border);
	}

	.monitor-editor,
	.monitor-figures article {
		border-radius: 22px;
		border: 1px solid var(--card-border);
		background: var(--card-bg);
		color: var(--card-fg);
	}

	.monitor-editor {
		min-height: 18.75rem;
		padding: 1.25rem;
		display: grid;
		align-content: end;
		gap: 0.55rem;
	}

	.monitor-editor p,
	.monitor-editor span,
	.monitor-editor h2 {
		margin: 0;
		color: inherit;
	}

	.monitor-editor h2 {
		font-size: clamp(2rem, 3.4vw, 3.2rem);
		line-height: 0.94;
		max-width: 10ch;
	}

	.monitor-figures {
		display: grid;
		gap: 0.85rem;
	}

	.monitor-figures article {
		padding: 1rem;
		display: grid;
		align-content: space-between;
		min-height: 5.7rem;
	}

	.monitor-figures span {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.74;
	}

	.monitor-figures strong {
		font-size: clamp(1.6rem, 3vw, 2.65rem);
		line-height: 1;
	}

	.workspace-shell {
		padding: 1rem 1.1rem 1.15rem;
		display: grid;
		gap: 1rem;
	}

	.workspace-top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: start;
	}

	.tablist {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.tablist button {
		display: grid;
		gap: 0.28rem;
		text-align: left;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink-strong);
		box-shadow: var(--shadow-md);
		transition:
			border-color 180ms ease,
			background 180ms ease,
			transform 180ms ease,
			box-shadow 180ms ease;
	}

	.tablist button.active {
		border-color: rgba(79, 110, 247, 0.24);
		background: rgba(79, 110, 247, 0.08);
		transform: translateY(-1px);
	}

	:global(html[data-theme='dark']) .tablist button.active {
		border-color: rgba(124, 148, 255, 0.3);
		background: rgba(124, 148, 255, 0.12);
	}

	.tablist button:hover,
	.tablist button:focus-visible {
		border-color: var(--accent);
		outline: none;
	}

	.tablist strong {
		font-size: 1rem;
	}

	.tablist span {
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.workspace-status {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.workspace-status div {
		display: grid;
		gap: 0.35rem;
		text-align: right;
	}

	.workspace-status strong {
		color: var(--ink-strong);
		font-size: 0.92rem;
	}

	.workspace-controls {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 0.9fr)) minmax(280px, 1.2fr);
		gap: 0.85rem;
		align-items: end;
	}

	label,
	.palette-controls label,
	.semantic-inputs label {
		display: grid;
		gap: 0.5rem;
	}

	label span,
	.palette-controls span,
	.semantic-inputs span {
		color: var(--ink-soft);
		font-size: 0.82rem;
	}

	.label-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	select,
	.palette-controls input,
	.semantic-inputs input {
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 0.9rem 0.95rem;
		background: #fff;
		color: var(--ink-strong);
		box-shadow: var(--shadow-md);
	}

	select:hover,
	select:focus-visible,
	.palette-controls input:hover,
	.palette-controls input:focus-visible,
	.semantic-inputs input:hover,
	.semantic-inputs input:focus-visible {
		border-color: var(--accent);
		outline: none;
		box-shadow: 0 0 0 4px var(--accent-soft);
	}

	:global(html[data-theme='dark']) select,
	:global(html[data-theme='dark']) .palette-controls input,
	:global(html[data-theme='dark']) .semantic-inputs input {
		background: var(--surface-3);
	}

	.pair-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.9rem;
		align-items: center;
		padding: 0.9rem 1rem;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		box-shadow: var(--shadow-md);
	}

	.pair-swatches {
		display: flex;
		gap: 0.45rem;
	}

	.pair-swatches span {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.pair-card strong {
		display: block;
		margin-top: 0.18rem;
		font-size: 0.98rem;
	}

	.pair-card p {
		margin: 0.22rem 0 0;
		color: var(--ink-soft);
		font-size: 0.88rem;
	}

	.copied {
		position: sticky;
		top: 1rem;
		z-index: 5;
		justify-self: end;
		margin-top: -0.15rem;
		padding: 0.8rem 1rem;
		border-radius: 999px;
		background: rgba(35, 133, 109, 0.12);
		border: 1px solid rgba(35, 133, 109, 0.24);
		color: var(--lime);
	}

	.tab-panel,
	.checker-grid,
	.checker-secondary,
	.simulation-grid,
	.simulation-top,
	.stack,
	.palette-stack {
		display: grid;
		gap: 1rem;
	}

	.checker-grid,
	.simulation-top,
	.simulation-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.checker-secondary {
		grid-template-columns: minmax(0, 1.22fr) minmax(320px, 0.78fr);
		margin-top: 1rem;
	}

	.composer-grid,
	.metric-grid {
		display: grid;
		gap: 0.85rem;
	}

	.composer-grid {
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
	}

	.toolbar-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1.1rem;
	}

	.toolbar-block {
		display: grid;
		gap: 0.75rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.chip {
		color: var(--ink-strong);
		border: 1px solid var(--line-strong);
		background: #fff;
		box-shadow: var(--shadow-md);
		padding: 0.72rem 0.92rem;
		font-weight: 600;
	}

	.chip.ghost {
		background: var(--surface-2);
	}

	:global(html[data-theme='dark']) .chip {
		background: var(--surface-3);
	}

	.chip:hover,
	.chip:focus-visible {
		border-color: var(--accent);
		outline: none;
		transform: translateY(-1px);
	}

	.audit-overview {
		display: grid;
		gap: 1rem;
	}

	.audit-hero {
		display: grid;
		grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1fr);
		gap: 0.9rem;
	}

	.audit-ratio,
	.audit-preview {
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		padding: 1.1rem;
	}

	.audit-ratio strong {
		display: block;
		margin-top: 0.45rem;
		font-size: clamp(2.6rem, 4.5vw, 4.25rem);
		line-height: 0.9;
	}

	.audit-ratio p {
		margin: 0.55rem 0 0;
		color: var(--ink-soft);
	}

	.audit-preview {
		display: grid;
		gap: 0.8rem;
	}

	.preview-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		color: var(--ink-soft);
	}

	.preview-surface {
		border-radius: 18px;
		border: 1px solid var(--preview-border);
		background: var(--preview-bg);
		color: var(--preview-fg);
		min-height: 11rem;
		padding: 1.15rem;
		display: grid;
		align-content: end;
		gap: 0.45rem;
	}

	.preview-surface p,
	.preview-surface span,
	.preview-surface h3 {
		margin: 0;
		color: inherit;
	}

	.preview-surface h3 {
		font-size: clamp(1.7rem, 3.2vw, 2.6rem);
		line-height: 0.92;
		max-width: 9ch;
	}

	.metric-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.metric-grid.compact {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.criterion-list {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.criterion-list.compact {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.criterion {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border-radius: 18px;
		background: var(--surface-2);
		border: 1px solid rgba(208, 87, 107, 0.18);
		box-shadow: var(--shadow-md);
	}

	.criterion.itemPass {
		border-color: rgba(35, 133, 109, 0.22);
	}

	.criterion strong {
		display: block;
		margin-bottom: 0.12rem;
	}

	.criterion p,
	.criterion em {
		margin: 0;
	}

	.criterion-metrics {
		text-align: right;
	}

	.criterion-metrics span {
		display: block;
		font-weight: 600;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.preview-card {
		min-height: 13.5rem;
		padding: 1rem;
		border: 1px solid var(--preview-border);
		border-radius: 22px;
		background: var(--preview-bg);
		color: var(--preview-fg);
	}

	.preview-kicker {
		display: inline-flex;
		margin-bottom: 0.85rem;
		padding: 0.36rem 0.58rem;
		border-radius: 999px;
		background: var(--preview-soft);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.preview-card h3,
	.preview-card strong,
	.preview-card p,
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
		gap: 0.75rem;
	}

	.preview-button {
		border-radius: 12px;
		padding: 0.82rem 1rem;
		font-weight: 700;
	}

	.preview-button.filled {
		border: 1px solid transparent;
		background: var(--accent);
		color: white;
	}

	.preview-button.outline {
		border: 1px solid var(--preview-border);
		background: rgba(255, 255, 255, 0.48);
		color: var(--preview-fg);
	}

	:global(html[data-theme='dark']) .preview-button.outline {
		background: transparent;
	}

	.forms input {
		width: 100%;
		margin-top: 0.45rem;
		border: 1px solid var(--preview-border);
		background: rgba(255, 255, 255, 0.56);
		color: var(--preview-fg);
		padding: 0.78rem 0.88rem;
		border-radius: 14px;
	}

	:global(html[data-theme='dark']) .forms input {
		background: var(--preview-soft);
	}

	.nav nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.nav a {
		padding-bottom: 0.25rem;
		border-bottom: 1px solid transparent;
		text-decoration: none;
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
		padding: 0.52rem 0;
		border-bottom: 1px solid var(--preview-border);
		text-align: left;
	}

	.alert-box {
		margin-top: 0.35rem;
		padding: 1rem;
		border-radius: 16px;
		border: 1px solid var(--preview-border);
		background: linear-gradient(135deg, rgba(79, 110, 247, 0.14), transparent 70%), var(--preview-soft);
	}

	.module-copy {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		margin-bottom: 1rem;
	}

	.effective-pair {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		align-items: center;
	}

	.effective-swatch {
		position: relative;
		width: 10rem;
		height: 10rem;
		border-radius: 28px;
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
		border-radius: 20px;
		border: 1px solid var(--line-strong);
	}

	.effective-meta {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.effective-meta strong,
	.module-copy strong,
	.tone-detail strong,
	.darkmode-meta strong,
	.palette-chip strong,
	.scenario strong,
	.semantic-summary strong,
	.recommended-pair strong {
		display: block;
		margin-top: 0.24rem;
		font-size: 1.08rem;
	}

	.darkmode-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		align-items: stretch;
	}

	.darkmode-preview {
		position: relative;
		width: 12rem;
		border-radius: 24px;
		overflow: hidden;
		border: 1px solid var(--line);
		background: var(--surface-3);
	}

	.darkmode-bg,
	.darkmode-fg {
		position: absolute;
		border-radius: 18px;
	}

	.darkmode-bg {
		inset: 0;
	}

	.darkmode-fg {
		inset: 18% 18% 18% 18%;
		border: 1px solid var(--line-strong);
	}

	.darkmode-meta {
		display: grid;
		gap: 1rem;
	}

	.scenario-grid,
	.semantic-summary-grid,
	.recommended-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.scenario,
	.semantic-summary,
	.recommended-pair,
	.tone-detail,
	.palette-chip {
		padding: 0.95rem 1rem;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		box-shadow: var(--shadow-md);
	}

	.scenario-swatch {
		position: relative;
		height: 5.2rem;
		margin-bottom: 0.8rem;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--line-strong);
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
		border-radius: 16px;
		border: 1px solid var(--line-strong);
	}

	.scenario span,
	.semantic-row span,
	.tone-ratios span {
		color: var(--ink-soft);
	}

	.spectrum {
		position: relative;
		display: grid;
		grid-template-columns: 1.1fr 1fr 1.1fr 1fr;
		height: 1.15rem;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--line);
	}

	.band.low {
		background: linear-gradient(90deg, rgba(208, 87, 107, 0.92), rgba(244, 156, 81, 0.92));
	}

	.band.mid {
		background: linear-gradient(90deg, rgba(244, 156, 81, 0.92), rgba(242, 191, 79, 0.9));
	}

	.band.opt {
		background: linear-gradient(90deg, rgba(35, 133, 109, 0.92), rgba(59, 179, 140, 0.9));
	}

	.band.high {
		background: linear-gradient(90deg, rgba(47, 125, 244, 0.92), rgba(83, 103, 250, 0.9));
	}

	.needle {
		position: absolute;
		top: -0.2rem;
		transform: translateX(-50%);
		width: 0.85rem;
		height: 1.55rem;
		border-radius: 999px;
		background: white;
		box-shadow: 0 0 0 4px rgba(79, 110, 247, 0.12);
	}

	.semantic-inputs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.semantic-summary.selected {
		border-color: rgba(79, 110, 247, 0.3);
		background: rgba(79, 110, 247, 0.08);
	}

	.semantic-table {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.semantic-row {
		display: grid;
		grid-template-columns: 1.15fr repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
		padding: 0.92rem 1rem;
		border-radius: 16px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		box-shadow: var(--shadow-md);
	}

	.semantic-row.good {
		border-color: rgba(35, 133, 109, 0.24);
	}

	.semantic-row.warn {
		border-color: rgba(242, 191, 79, 0.28);
	}

	.semantic-row.bad {
		border-color: rgba(208, 87, 107, 0.24);
	}

	.palette-controls,
	.recommendations,
	.tone-detail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.7fr) auto;
		gap: 0.9rem;
		align-items: end;
	}

	.palette-chip {
		min-width: 16rem;
	}

	.tone-detail {
		grid-template-columns: auto 1fr auto;
		align-items: center;
	}

	.tone-swatch,
	.recommended-preview {
		width: 4.2rem;
		height: 4.2rem;
		border-radius: 18px;
		border: 1px solid var(--line-strong);
	}

	.tone-ratios {
		display: grid;
		gap: 0.35rem;
		font-size: 0.9rem;
	}

	.recommendations {
		grid-template-columns: minmax(260px, 0.8fr) 1.2fr;
		margin-top: 1rem;
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
		font-size: 1.28rem;
		font-weight: 700;
		border-width: 1px;
		border-style: solid;
	}

	.export-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.export-card {
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		overflow: hidden;
		box-shadow: var(--shadow-md);
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
		color: var(--ink-strong);
	}

	button {
		cursor: pointer;
	}

	@media (max-width: 1240px) {
		.masthead-grid,
		.workspace-top,
		.workspace-controls,
		.checker-grid,
		.checker-secondary,
		.simulation-top,
		.simulation-grid,
		.export-grid,
		.preview-grid,
		.semantic-inputs,
		.recommendations,
		.palette-controls,
		.tone-detail {
			grid-template-columns: 1fr;
		}

		.composer-grid,
		.criterion-list.compact,
		.metric-grid.compact {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.workspace-status {
			justify-content: flex-start;
		}

		.monitor-stage {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
		.page {
			width: min(100% - 1rem, 1460px);
			padding-top: 1rem;
		}

		.masthead,
		.workspace-shell {
			border-radius: 24px;
		}

		.masthead-copy h1 {
			font-size: clamp(2.4rem, 13vw, 4rem);
		}

		.tablist,
		.composer-grid,
		.metric-grid,
		.metric-grid.compact,
		.preview-grid,
		.scenario-grid,
		.semantic-summary-grid,
		.recommended-grid,
		.semantic-inputs,
		.criterion-list.compact,
		.module-copy,
		.effective-meta,
		.semantic-row,
		.toolbar-row {
			grid-template-columns: 1fr;
		}

		.monitor-meta,
		.brandline,
		.palette-controls,
		.tone-detail,
		.effective-pair,
		.darkmode-card,
		.audit-hero {
			grid-template-columns: 1fr;
			flex-direction: column;
		}

		.monitor-pills {
			justify-content: flex-start;
		}

		.effective-swatch,
		.darkmode-preview {
			width: 100%;
			height: 12rem;
		}

		.workspace-shell {
			padding: 0.9rem;
		}
	}
</style>
