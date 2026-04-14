interface EyeDropperOpenResult {
	sRGBHex: string;
}

interface EyeDropper {
	open: () => Promise<EyeDropperOpenResult>;
}

interface EyeDropperConstructor {
	new (): EyeDropper;
}

interface Window {
	EyeDropper?: EyeDropperConstructor;
}

declare const EyeDropper: EyeDropperConstructor;

declare module 'apca-w3' {
	export const APCAcontrast: (textY: number, backgroundY: number) => number;
	export const sRGBtoY: (rgb: [number, number, number]) => number;
}

declare module 'culori' {
	export const clampRgb: (color: any) => any;
	export const converter: (mode: string) => (value: any) => any;
	export const formatHex: (color: any) => string;
	export const formatHex8: (color: any) => string;
	export const parse: (input: string) => any;
}
