export type RgbaColor = {
	r: number;
	g: number;
	b: number;
	alpha: number;
};

export type ColorParseResult =
	| {
			ok: true;
			color: RgbaColor;
	  }
	| {
			ok: false;
			error: string;
	  };

export type VisionConditionId =
	| 'normal'
	| 'grayscale'
	| 'protanopia'
	| 'protanomaly'
	| 'deuteranopia'
	| 'deuteranomaly'
	| 'tritanopia'
	| 'tritanomaly'
	| 'achromatopsia';

export type AmbientConditionId = 'dark-room' | 'office' | 'cloudy' | 'direct-sun' | 'phone-sun';

export type PrintModeId = 'screen' | 'laser-bw' | 'inkjet-bw' | 'cmyk' | 'newspaper';

export type ContrastCriterion = {
	id: string;
	label: string;
	shortLabel: string;
	threshold: number;
	unit: 'ratio' | 'Lc';
	note: string;
};

export type ContrastCriterionResult = {
	criterion: ContrastCriterion;
	value: number;
	passed: boolean;
	margin: number;
};

export type VisionCondition = {
	id: VisionConditionId;
	label: string;
	description: string;
	matrix?: number[][];
};

export type AmbientCondition = {
	id: AmbientConditionId;
	label: string;
	description: string;
	glare: number;
	blackLift: number;
	gamma: number;
};

export type PrintMode = {
	id: PrintModeId;
	label: string;
	description: string;
};

export type PairHistoryEntry = {
	id: string;
	fg: string;
	bg: string;
	surface: string;
	savedAt: string;
};

export type PaletteTone = {
	step: number;
	label: string;
	css: string;
	hex: string;
	oklch: string;
	contrastOnWhite: number;
	contrastOnBlack: number;
};

export type GeneratedPalette = {
	light: PaletteTone[];
	dark: PaletteTone[];
};

export type SemanticColorSet = {
	error: string;
	success: string;
	warning: string;
	info: string;
};

export type SemanticPairScore = {
	a: string;
	b: string;
	delta: number;
	ratio: number;
	status: 'clear' | 'borderline' | 'risky';
};

export type AnalysisPipelineOptions = {
	vision: VisionConditionId;
	ambient: AmbientConditionId;
	printMode: PrintModeId;
};
