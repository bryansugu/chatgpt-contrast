import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { clampRgb, converter, formatHex, formatHex8, parse } from 'culori';
import {
	AMBIENT_CONDITIONS,
	CONTRAST_CRITERIA,
	PRINT_MODES,
	VISION_CONDITIONS
} from './constants';
import type {
	AnalysisPipelineOptions,
	ColorParseResult,
	ContrastCriterionResult,
	RgbaColor,
	SemanticPairScore,
	VisionConditionId
} from './types';

const toRgb = converter('rgb');
const toOklab = converter('oklab');
const toOklch = converter('oklch');

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function parseUserColor(value: string): ColorParseResult {
	const parsed = parse(value.trim());

	if (!parsed) {
		return {
			ok: false,
			error: 'Formato no reconocido. Usa hex, rgb(), hsl() u oklch().'
		};
	}

	const rgb = clampRgb(toRgb(parsed));

	if (!rgb || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
		return {
			ok: false,
			error: 'No fue posible convertir el color al espacio RGB.'
		};
	}

	return {
		ok: true,
		color: {
			r: clamp01(rgb.r),
			g: clamp01(rgb.g),
			b: clamp01(rgb.b),
			alpha: clamp01(rgb.alpha ?? 1)
		}
	};
}

export function withAlpha(color: RgbaColor, alpha: number): RgbaColor {
	return {
		...color,
		alpha: clamp01(alpha)
	};
}

export function rgbaToCss(color: RgbaColor): string {
	const r = Math.round(color.r * 255);
	const g = Math.round(color.g * 255);
	const b = Math.round(color.b * 255);

	if (color.alpha >= 0.999) {
		return `rgb(${r} ${g} ${b})`;
	}

	return `rgb(${r} ${g} ${b} / ${color.alpha.toFixed(3)})`;
}

export function rgbaToHex(color: RgbaColor): string {
	const base = {
		mode: 'rgb',
		r: clamp01(color.r),
		g: clamp01(color.g),
		b: clamp01(color.b),
		alpha: clamp01(color.alpha)
	};

	return color.alpha >= 0.999 ? formatHex(base) : formatHex8(base);
}

export function rgbaToOklchString(color: RgbaColor): string {
	const oklch = toOklch({
		mode: 'rgb',
		r: clamp01(color.r),
		g: clamp01(color.g),
		b: clamp01(color.b)
	});

	if (!oklch || typeof oklch.l !== 'number') {
		return 'oklch(?)';
	}

	const lightness = `${(oklch.l * 100).toFixed(1)}%`;
	const chroma = (oklch.c ?? 0).toFixed(3);
	const hue = ((oklch.h ?? 0) + 360) % 360;

	return `oklch(${lightness} ${chroma} ${hue.toFixed(1)})`;
}

export function compositeColors(top: RgbaColor, bottom: RgbaColor): RgbaColor {
	const alpha = top.alpha + bottom.alpha * (1 - top.alpha);

	if (alpha <= 0) {
		return { r: 0, g: 0, b: 0, alpha: 0 };
	}

	return {
		r: (top.r * top.alpha + bottom.r * bottom.alpha * (1 - top.alpha)) / alpha,
		g: (top.g * top.alpha + bottom.g * bottom.alpha * (1 - top.alpha)) / alpha,
		b: (top.b * top.alpha + bottom.b * bottom.alpha * (1 - top.alpha)) / alpha,
		alpha
	};
}

export function relativeLuminance(color: RgbaColor): number {
	const linearize = (channel: number) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

	const r = linearize(color.r);
	const g = linearize(color.g);
	const b = linearize(color.b);

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagContrast(foreground: RgbaColor, background: RgbaColor): number {
	const l1 = relativeLuminance(foreground);
	const l2 = relativeLuminance(background);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);

	return Number((((lighter + 0.05) / (darker + 0.05)) as number).toFixed(2));
}

export function apcaContrastValue(foreground: RgbaColor, background: RgbaColor): number {
	const textY = sRGBtoY([
		Math.round(clamp01(foreground.r) * 255),
		Math.round(clamp01(foreground.g) * 255),
		Math.round(clamp01(foreground.b) * 255)
	]);
	const bgY = sRGBtoY([
		Math.round(clamp01(background.r) * 255),
		Math.round(clamp01(background.g) * 255),
		Math.round(clamp01(background.b) * 255)
	]);

	return Number(APCAcontrast(textY, bgY).toFixed(1));
}

export function applyMatrix(color: RgbaColor, matrix?: number[][]): RgbaColor {
	if (!matrix) {
		return color;
	}

	const r = color.r;
	const g = color.g;
	const b = color.b;

	return {
		r: clamp01(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b),
		g: clamp01(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b),
		b: clamp01(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b),
		alpha: color.alpha
	};
}

export function simulateAmbient(color: RgbaColor, ambientId: AnalysisPipelineOptions['ambient']): RgbaColor {
	const ambient = AMBIENT_CONDITIONS.find((item) => item.id === ambientId) ?? AMBIENT_CONDITIONS[0];
	const mixWhite = ambient.glare;
	const lift = ambient.blackLift;

	const remap = (channel: number) => {
		const gammaAdjusted = clamp01(channel ** ambient.gamma);
		const lifted = gammaAdjusted + lift * (1 - gammaAdjusted);
		return clamp01(lifted * (1 - mixWhite) + mixWhite);
	};

	return {
		r: remap(color.r),
		g: remap(color.g),
		b: remap(color.b),
		alpha: color.alpha
	};
}

export function simulatePrint(color: RgbaColor, printMode: AnalysisPipelineOptions['printMode']): RgbaColor {
	if (printMode === 'screen') {
		return color;
	}

	const luminance = relativeLuminance(color);

	if (printMode === 'laser-bw') {
		const tone = clamp01(0.05 + luminance * 0.9);
		return { r: tone, g: tone, b: tone, alpha: color.alpha };
	}

	if (printMode === 'inkjet-bw') {
		const tone = clamp01(0.12 + luminance * 0.74);
		return {
			r: clamp01(tone * 0.98 + 0.02),
			g: clamp01(tone * 0.97 + 0.02),
			b: clamp01(tone * 0.93 + 0.04),
			alpha: color.alpha
		};
	}

	const c = 1 - color.r;
	const m = 1 - color.g;
	const y = 1 - color.b;
	const k = Math.min(c, m, y) * (printMode === 'newspaper' ? 0.75 : 0.88);

	const reconstructed = {
		r: clamp01(1 - Math.min(1, c * 0.86 + k)),
		g: clamp01(1 - Math.min(1, m * 0.84 + k)),
		b: clamp01(1 - Math.min(1, y * 0.82 + k)),
		alpha: color.alpha
	};

	if (printMode === 'newspaper') {
		const paper = { r: 0.95, g: 0.93, b: 0.86, alpha: 1 };
		const dotGain = {
			r: clamp01(reconstructed.r * 0.82),
			g: clamp01(reconstructed.g * 0.82),
			b: clamp01(reconstructed.b * 0.8),
			alpha: 1
		};

		return {
			r: clamp01(dotGain.r * 0.78 + paper.r * 0.22),
			g: clamp01(dotGain.g * 0.78 + paper.g * 0.22),
			b: clamp01(dotGain.b * 0.78 + paper.b * 0.22),
			alpha: color.alpha
		};
	}

	return reconstructed;
}

export function simulateVision(color: RgbaColor, vision: VisionConditionId): RgbaColor {
	const condition = VISION_CONDITIONS.find((item) => item.id === vision) ?? VISION_CONDITIONS[0];
	return applyMatrix(color, condition.matrix);
}

export function applyAnalysisPipeline(
	fg: RgbaColor,
	bg: RgbaColor,
	surface: RgbaColor,
	options: AnalysisPipelineOptions
) {
	const compositedBackground = compositeColors(bg, surface);
	const compositedForeground = compositeColors(fg, compositedBackground);

	const transform = (color: RgbaColor) =>
		simulateVision(simulatePrint(simulateAmbient(color, options.ambient), options.printMode), options.vision);

	return {
		background: transform(compositedBackground),
		foreground: transform(compositedForeground),
		baseBackground: compositedBackground,
		baseForeground: compositedForeground
	};
}

export function evaluateCriteria(
	foreground: RgbaColor,
	background: RgbaColor
): ContrastCriterionResult[] {
	const ratio = wcagContrast(foreground, background);
	const apca = Math.abs(apcaContrastValue(foreground, background));

	return CONTRAST_CRITERIA.map((criterion) => {
		const value = criterion.unit === 'ratio' ? ratio : apca;
		const margin = Number((value - criterion.threshold).toFixed(2));

		return {
			criterion,
			value,
			margin,
			passed: value >= criterion.threshold
		};
	});
}

export function contrastSummary(results: ContrastCriterionResult[]) {
	const passed = results.filter((item) => item.passed).length;
	return `${passed}/${results.length}`;
}

export function polarityLabel(apca: number): string {
	if (apca < 0) {
		return 'claro sobre oscuro';
	}

	return 'oscuro sobre claro';
}

export function alphaCurve(
	foreground: RgbaColor,
	background: RgbaColor,
	surface: RgbaColor,
	options: AnalysisPipelineOptions,
	steps = 40
) {
	const samples = [];

	for (let index = 0; index <= steps; index += 1) {
		const alpha = index / steps;
		const piped = applyAnalysisPipeline(withAlpha(foreground, alpha), background, surface, options);
		samples.push({
			alpha,
			ratio: wcagContrast(piped.foreground, piped.background)
		});
	}

	return samples;
}

export function findMinimumAlpha(
	foreground: RgbaColor,
	background: RgbaColor,
	surface: RgbaColor,
	options: AnalysisPipelineOptions,
	target = 4.5
) {
	for (let alpha = 0; alpha <= 1.0001; alpha += 0.0025) {
		const piped = applyAnalysisPipeline(withAlpha(foreground, alpha), background, surface, options);
		if (wcagContrast(piped.foreground, piped.background) >= target) {
			return Number(alpha.toFixed(3));
		}
	}

	return null;
}

export function luminanceY(color: RgbaColor): number {
	return Number(relativeLuminance(color).toFixed(4));
}

export function deltaOklab(first: RgbaColor, second: RgbaColor): number {
	const a = toOklab({ mode: 'rgb', r: first.r, g: first.g, b: first.b });
	const b = toOklab({ mode: 'rgb', r: second.r, g: second.g, b: second.b });

	if (!a || !b) {
		return 0;
	}

	const dl = (a.l ?? 0) - (b.l ?? 0);
	const da = (a.a ?? 0) - (b.a ?? 0);
	const db = (a.b ?? 0) - (b.b ?? 0);

	return Number(Math.sqrt(dl * dl + da * da + db * db).toFixed(3));
}

export function semanticScore(first: RgbaColor, second: RgbaColor): SemanticPairScore['status'] {
	const delta = deltaOklab(first, second);

	if (delta >= 0.12) {
		return 'clear';
	}

	if (delta >= 0.075) {
		return 'borderline';
	}

	return 'risky';
}

export function buildSemanticPairScore(
	aLabel: string,
	bLabel: string,
	first: RgbaColor,
	second: RgbaColor
): SemanticPairScore {
	return {
		a: aLabel,
		b: bLabel,
		delta: deltaOklab(first, second),
		ratio: wcagContrast(first, second),
		status: semanticScore(first, second)
	};
}

export function colorDistanceDescription(delta: number): string {
	if (delta >= 0.12) {
		return 'clara';
	}

	if (delta >= 0.075) {
		return 'frontera';
	}

	return 'riesgosa';
}

export function fatigueStatus(ratio: number) {
	if (ratio < 4.5) {
		return {
			label: 'Insuficiente',
			tone: 'low',
			description: 'La lectura sostenida pierde claridad.'
		};
	}

	if (ratio < 7) {
		return {
			label: 'Aceptable',
			tone: 'moderate',
			description: 'Cumple AA, pero aún puede cansar en sesiones largas.'
		};
	}

	if (ratio <= 13) {
		return {
			label: 'Zona óptima',
			tone: 'optimal',
			description: 'Rango recomendado para confort visual prolongado.'
		};
	}

	return {
		label: 'Muy alto',
		tone: 'high',
		description: 'El contraste extremo puede generar brillo o vibración visual.'
	};
}

export function contrastSpectrumPosition(ratio: number): number {
	const bounded = Math.min(21, Math.max(1, ratio));
	return Number((((bounded - 1) / 20) * 100).toFixed(1));
}

export function ratioMarginLabel(value: number, threshold: number, unit: 'ratio' | 'Lc') {
	const delta = value - threshold;
	const abs = Math.abs(delta).toFixed(unit === 'ratio' ? 2 : 1);
	return delta >= 0 ? `+${abs} ${unit}` : `-${abs} ${unit}`;
}
