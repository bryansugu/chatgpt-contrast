import type { GeneratedPalette } from './types';

function exportLines(prefix: string, values: { step: number; hex: string }[]) {
	return values.map((tone) => `  --${prefix}-${tone.step}: ${tone.hex};`).join('\n');
}

export function exportCssVariables(name: string, palette: GeneratedPalette) {
	const safe = name.trim().toLowerCase().replace(/\s+/g, '-');
	return `:root {\n${exportLines(`${safe}`, palette.light)}\n}\n\n[data-theme="dark"] {\n${exportLines(`${safe}-dark`, palette.dark)}\n}`;
}

export function exportTailwindConfig(name: string, palette: GeneratedPalette) {
	const safe = name.trim().toLowerCase().replace(/\s+/g, '-');
	const serialize = (tones: { step: number; hex: string }[]) =>
		tones.map((tone) => `        ${tone.step}: '${tone.hex}'`).join(',\n');

	return `export default {\n  theme: {\n    extend: {\n      colors: {\n        '${safe}': {\n${serialize(palette.light)}\n        },\n        '${safe}-dark': {\n${serialize(palette.dark)}\n        }\n      }\n    }\n  }\n};`;
}

export function exportDesignTokens(name: string, palette: GeneratedPalette) {
	const safe = name.trim().toLowerCase().replace(/\s+/g, '-');
	const group = (tones: { step: number; hex: string; label: string }[]) =>
		tones
			.map(
				(tone) =>
					`      "${tone.step}": {\n        "$value": "${tone.hex}",\n        "$type": "color",\n        "$description": "${tone.label}"\n      }`
			)
			.join(',\n');

	return `{\n  "${safe}": {\n    "light": {\n${group(palette.light)}\n    },\n    "dark": {\n${group(palette.dark)}\n    }\n  }\n}`;
}
