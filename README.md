# ChromaCheck

ChromaCheck es una app profesional de contraste y accesibilidad construida con **SvelteKit 2** y **Svelte 5**. Analiza pares `foreground/background` con soporte de transparencia, calcula **WCAG 2.2** y **APCA**, y suma simulación de visión, luz exterior, impresión, fatiga visual y generación de paletas perceptuales en **OKLCH**.

## Qué incluye

- WCAG 2.2 con 11 chequeos visibles, margen exacto sobre o bajo el umbral y soporte para texto, UI, íconos, uso de color y resize proxy.
- APCA con lectura de polaridad y umbrales para cuerpo, contenido y UI.
- Simulador visual con 9 condiciones: visión normal, grayscale, protanopia, protanomalía, deuteranopia, deuteranomalía, tritanopia, tritanomalía y acromatopsia.
- Módulo de alpha compositing con curva de contraste por opacidad y alpha mínimo para AA.
- Generador de modo oscuro manteniendo intención cromática en OKLCH.
- Simuladores de luz exterior, impresión y confort/fatiga visual.
- Contraste semántico entre error, éxito, warning e info.
- Generador de paletas de 12 pasos para modo claro y oscuro, con exportación a CSS variables, Tailwind y Design Tokens DTCG.
- Historial local de los últimos 8 pares válidos, presets y soporte de EyeDropper API cuando el navegador la expone.

## Desarrollo

```bash
npm install
npm run dev
```

Build y verificación:

```bash
npm run check
npm run build
```

## Deploy en Railway

La app usa `@sveltejs/adapter-node`, así que Railway puede desplegarla como servicio Node sin cambios extra.

Configuración recomendada:

- Build command: `npm run build`
- Start command: `npm start`
- Node version: `20+`

`adapter-node` usa la variable `PORT` que Railway inyecta automáticamente.

## Estructura

- [`src/routes/+page.svelte`](/Users/centrodiseno/Documents/New project/src/routes/+page.svelte): interfaz principal.
- [`src/lib/color/engine.ts`](/Users/centrodiseno/Documents/New project/src/lib/color/engine.ts): parsing, contrastes, composición y simulaciones.
- [`src/lib/color/palette.ts`](/Users/centrodiseno/Documents/New project/src/lib/color/palette.ts): escalas perceptuales y par oscuro equivalente.
- [`src/lib/color/exporters.ts`](/Users/centrodiseno/Documents/New project/src/lib/color/exporters.ts): exportación de tokens.

## Subir a GitHub

```bash
git init
git add .
git commit -m "feat: launch ChromaCheck"
git branch -M main
git remote add origin <tu-repo>
git push -u origin main
```
