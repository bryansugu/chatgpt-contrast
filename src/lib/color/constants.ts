import type {
	AmbientCondition,
	ContrastCriterion,
	PrintMode,
	SemanticColorSet,
	VisionCondition
} from './types';

export const VISION_CONDITIONS: VisionCondition[] = [
	{
		id: 'normal',
		label: 'Visión normal',
		description: 'Sin transformación perceptual adicional.'
	},
	{
		id: 'grayscale',
		label: 'Escala de grises',
		description: 'Reduce el color a luminancia perceptual.',
		matrix: [
			[0.2126, 0.7152, 0.0722],
			[0.2126, 0.7152, 0.0722],
			[0.2126, 0.7152, 0.0722]
		]
	},
	{
		id: 'protanopia',
		label: 'Protanopia',
		description: 'Ausencia funcional de conos L.',
		matrix: [
			[0.152286, 1.052583, -0.204868],
			[0.114503, 0.786281, 0.099216],
			[-0.003882, -0.048116, 1.051998]
		]
	},
	{
		id: 'protanomaly',
		label: 'Protanomalía',
		description: 'Severidad media basada en matrices de Machado 2009.',
		matrix: [
			[0.630323, 0.465641, -0.095964],
			[0.069181, 0.890046, 0.040773],
			[-0.006308, -0.007724, 1.014032]
		]
	},
	{
		id: 'deuteranopia',
		label: 'Deuteranopia',
		description: 'Ausencia funcional de conos M.',
		matrix: [
			[0.367322, 0.860646, -0.227968],
			[0.280085, 0.672501, 0.047413],
			[-0.01182, 0.04294, 0.968881]
		]
	},
	{
		id: 'deuteranomaly',
		label: 'Deuteranomalía',
		description: 'Severidad media basada en matrices de Machado 2009.',
		matrix: [
			[0.498864, 0.674741, -0.173604],
			[0.205199, 0.754872, 0.039929],
			[-0.011131, 0.027667, 0.983465]
		]
	},
	{
		id: 'tritanopia',
		label: 'Tritanopia',
		description: 'Ausencia funcional de conos S.',
		matrix: [
			[1.255528, -0.076749, -0.178779],
			[-0.078411, 0.930809, 0.147602],
			[0.004733, 0.691367, 0.3039]
		]
	},
	{
		id: 'tritanomaly',
		label: 'Tritanomalía',
		description: 'Severidad media basada en matrices de Machado 2009.',
		matrix: [
			[1.017277, -0.027029, 0.009752],
			[-0.006113, 0.958479, 0.047634],
			[-0.027882, 0.140212, 0.88767]
		]
	},
	{
		id: 'achromatopsia',
		label: 'Acromatopsia',
		description: 'Pérdida casi total de discriminación cromática.',
		matrix: [
			[0.299, 0.587, 0.114],
			[0.299, 0.587, 0.114],
			[0.299, 0.587, 0.114]
		]
	}
];

export const AMBIENT_CONDITIONS: AmbientCondition[] = [
	{
		id: 'dark-room',
		label: 'Cuarto oscuro',
		description: 'Máximo detalle en negros y mínimo velo de luz.',
		glare: 0,
		blackLift: 0,
		gamma: 1
	},
	{
		id: 'office',
		label: 'Oficina',
		description: 'Condición de escritorio con reflejo leve.',
		glare: 0.045,
		blackLift: 0.015,
		gamma: 1
	},
	{
		id: 'cloudy',
		label: 'Nublado',
		description: 'Luz ambiente alta pero difusa.',
		glare: 0.11,
		blackLift: 0.04,
		gamma: 0.99
	},
	{
		id: 'direct-sun',
		label: 'Sol directo',
		description: 'Contraste reducido por reflejo fuerte y elevación del negro.',
		glare: 0.24,
		blackLift: 0.1,
		gamma: 0.97
	},
	{
		id: 'phone-sun',
		label: 'Celular al sol',
		description: 'Escenario extremo de visibilidad exterior.',
		glare: 0.36,
		blackLift: 0.16,
		gamma: 0.94
	}
];

export const PRINT_MODES: PrintMode[] = [
	{
		id: 'screen',
		label: 'Pantalla',
		description: 'Representación RGB estándar.'
	},
	{
		id: 'laser-bw',
		label: 'Láser B&N',
		description: 'Blanco y negro con rango dinámico alto.'
	},
	{
		id: 'inkjet-bw',
		label: 'Inkjet B&N',
		description: 'Blanco y negro con textura más suave.'
	},
	{
		id: 'cmyk',
		label: 'CMYK',
		description: 'Compresión típica de imprenta a cuatricromía.'
	},
	{
		id: 'newspaper',
		label: 'Papel periódico',
		description: 'Simula ganancia de punto y papel poroso.'
	}
];

export const CONTRAST_CRITERIA: ContrastCriterion[] = [
	{
		id: 'wcag-aa-normal',
		label: 'WCAG 2.2 1.4.3 AA texto normal',
		shortLabel: 'AA normal',
		threshold: 4.5,
		unit: 'ratio',
		note: 'Mínimo para texto normal.'
	},
	{
		id: 'wcag-aa-large',
		label: 'WCAG 2.2 1.4.3 AA texto grande',
		shortLabel: 'AA grande',
		threshold: 3,
		unit: 'ratio',
		note: 'Mínimo para texto grande o seminegrita.'
	},
	{
		id: 'wcag-aaa-normal',
		label: 'WCAG 2.2 1.4.6 AAA texto normal',
		shortLabel: 'AAA normal',
		threshold: 7,
		unit: 'ratio',
		note: 'Objetivo reforzado para lectura sostenida.'
	},
	{
		id: 'wcag-aaa-large',
		label: 'WCAG 2.2 1.4.6 AAA texto grande',
		shortLabel: 'AAA grande',
		threshold: 4.5,
		unit: 'ratio',
		note: 'Umbral reforzado para titulares y texto grande.'
	},
	{
		id: 'wcag-ui',
		label: 'WCAG 2.2 1.4.11 componentes UI',
		shortLabel: 'UI',
		threshold: 3,
		unit: 'ratio',
		note: 'Controles, estados y bordes visibles.'
	},
	{
		id: 'wcag-icons',
		label: 'WCAG 2.2 1.4.11 íconos y objetos gráficos',
		shortLabel: 'Íconos',
		threshold: 3,
		unit: 'ratio',
		note: 'Pictogramas y gráficos informativos.'
	},
	{
		id: 'wcag-use-of-color',
		label: 'WCAG 2.2 1.4.1 uso de color',
		shortLabel: 'Uso de color',
		threshold: 3,
		unit: 'ratio',
		note: 'Proxy para diferenciación cuando el color es la pista principal.'
	},
	{
		id: 'wcag-resize',
		label: 'WCAG 2.2 1.4.4 redimensionamiento',
		shortLabel: 'Resize 200%',
		threshold: 3,
		unit: 'ratio',
		note: 'Proxy cromático para texto al 200%, equivalente a texto grande.'
	},
	{
		id: 'apca-body',
		label: 'APCA cuerpo de texto',
		shortLabel: 'APCA cuerpo',
		threshold: 75,
		unit: 'Lc',
		note: 'APCA in a Nutshell: mínimo para body text.'
	},
	{
		id: 'apca-content',
		label: 'APCA contenido secundario',
		shortLabel: 'APCA contenido',
		threshold: 60,
		unit: 'Lc',
		note: 'Mínimo recomendado para texto legible no corrido.'
	},
	{
		id: 'apca-ui',
		label: 'APCA UI / pictogramas',
		shortLabel: 'APCA UI',
		threshold: 45,
		unit: 'Lc',
		note: 'Mínimo para titulares grandes, UI e íconos detallados.'
	}
];

export const PRESET_PAIRS = [
	{
		name: 'Slate editorial',
		fg: '#0f172a',
		bg: '#f8fafc',
		surface: '#ffffff'
	},
	{
		name: 'Ocean data',
		fg: '#083344',
		bg: '#ecfeff',
		surface: '#ffffff'
	},
	{
		name: 'Rose alert',
		fg: '#7f1d1d',
		bg: '#fff1f2',
		surface: '#fff1f2'
	},
	{
		name: 'Amber dashboard',
		fg: '#422006',
		bg: '#fef3c7',
		surface: '#fffbeb'
	},
	{
		name: 'Dark terminal',
		fg: '#f8fafc',
		bg: '#0f172a',
		surface: '#020617'
	},
	{
		name: 'Violet brand',
		fg: '#312e81',
		bg: '#eef2ff',
		surface: '#ffffff'
	}
];

export const DEFAULT_SEMANTIC_COLORS: SemanticColorSet = {
	error: '#dc2626',
	success: '#16a34a',
	warning: '#d97706',
	info: '#0ea5e9'
};

export const PALETTE_STEP_LABELS = [
	'App bg',
	'Subtle bg',
	'UI bg',
	'UI hover',
	'UI active',
	'Border',
	'Border strong',
	'Solid',
	'Solid hover',
	'Text low',
	'Text high',
	'Text max'
];

export const STORAGE_KEYS = {
	history: 'chromacheck-history'
};

