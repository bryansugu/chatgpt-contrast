import { clampRgb, converter } from 'culori';
import { PALETTE_STEP_LABELS } from './constants';
import {
	apcaContrastValue,
	parseUserColor,
	rgbaToCss,
	rgbaToHex,
	rgbaToOklchString,
	wcagContrast
} from './engine';
import type { GeneratedPalette, PaletteTone, RgbaColor } from './types';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const lightnessLight = [0.992, 0.978, 0.957, 0.93, 0.888, 0.81, 0.71, 0.61, 0.56, 0.45, 0.34, 0.23];
const lightnessDark = [0.16, 0.19, 0.225, 0.265, 0.315, 0.4, 0.5, 0.6, 0.665, 0.785, 0.885, 0.965];
const chromaLight = [0.08, 0.12, 0.18, 0.24, 0.32, 0.42, 0.55, 0.76, 0.86, 0.7, 0.48, 0.3];
const chromaDark = [0.14, 0.19, 0.24, 0.29, 0.37, 0.48, 0.62, 0.76, 0.84, 0.68, 0.42, 0.24];

function rgbFromOklch(l: number, c: number, h: number): RgbaColor {
	const rgb = clampRgb(
		toRgb({
			mode: 'oklch',
			l: clamp01(l),
			c: Math.max(0, c),
			h
		})
	);

	return {
		r: clamp01(rgb?.r ?? 0),
		g: clamp01(rgb?.g ?? 0),
		b: clamp01(rgb?.b ?? 0),
		alpha: 1
	};
}

function buildTone(step: number, label: string, color: RgbaColor): PaletteTone {
	const white = { r: 1, g: 1, b: 1, alpha: 1 };
	const black = { r: 0, g: 0, b: 0, alpha: 1 };

	return {
		step,
		label,
		css: rgbaToCss(color),
		hex: rgbaToHex(color),
		oklch: rgbaToOklchString(color),
		contrastOnWhite: wcagContrast(color, white),
		contrastOnBlack: wcagContrast(color, black)
	};
}

export function generatePalette(baseInput: string): GeneratedPalette {
	const parsed = parseUserColor(baseInput);

	if (!parsed.ok) {
		return {
			light: [],
			dark: []
		};
	}

	const base = parsed.color;
	const oklch = toOklch({ mode: 'rgb', r: base.r, g: base.g, b: base.b });
	const hue = (oklch?.h ?? 240) % 360;
	const chroma = Math.max(0.03, Math.min(0.34, oklch?.c ?? 0.18));

	const light = PALETTE_STEP_LABELS.map((label, index) =>
		buildTone(
			index + 1,
			label,
			rgbFromOklch(lightnessLight[index], chroma * chromaLight[index], hue)
		)
	);
	const dark = PALETTE_STEP_LABELS.map((label, index) =>
		buildTone(
			index + 1,
			label,
			rgbFromOklch(lightnessDark[index], chroma * chromaDark[index], hue)
		)
	);

	return { light, dark };
}

export function generateDarkModePair(
	foreground: RgbaColor,
	background: RgbaColor,
	targetRatio: number
) {
	const fgOklch = toOklch({ mode: 'rgb', r: foreground.r, g: foreground.g, b: foreground.b });
	const bgOklch = toOklch({ mode: 'rgb', r: background.r, g: background.g, b: background.b });

	const bgHue = bgOklch?.h ?? fgOklch?.h ?? 260;
	const fgHue = fgOklch?.h ?? bgHue;
	const bgChroma = Math.min(0.12, bgOklch?.c ?? 0.02);
	const fgChroma = Math.min(0.28, Math.max(0.04, fgOklch?.c ?? 0.12));
	const backgroundDark = rgbFromOklch(Math.max(0.08, 1 - (bgOklch?.l ?? 0.9) * 0.92), bgChroma, bgHue);

	let bestForeground = rgbFromOklch(0.9, fgChroma, fgHue);
	let bestDistance = Infinity;

	for (let lightness = 0.5; lightness <= 0.99; lightness += 0.005) {
		const candidate = rgbFromOklch(lightness, fgChroma, fgHue);
		const ratio = wcagContrast(candidate, backgroundDark);
		const distance = Math.abs(ratio - targetRatio);

		if (distance < bestDistance) {
			bestDistance = distance;
			bestForeground = candidate;
		}
	}

	return {
		foreground: bestForeground,
		background: backgroundDark,
		ratio: wcagContrast(bestForeground, backgroundDark),
		apca: apcaContrastValue(bestForeground, backgroundDark)
	};
}

