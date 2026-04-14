<script lang="ts">
	let {
		points = [],
		threshold = 4.5,
		minAlpha = null
	}: {
		points?: { alpha: number; ratio: number }[];
		threshold?: number;
		minAlpha?: number | null;
	} = $props();

	const width = 520;
	const height = 180;

	let maxRatio = $derived(Math.max(threshold + 1.5, ...points.map((point) => point.ratio), 7));
	let path = $derived(
		points
			.map((point) => {
				const x = point.alpha * width;
				const y = height - ((point.ratio - 1) / (maxRatio - 1)) * height;
				return `${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(' ')
	);
	let thresholdY = $derived(height - ((threshold - 1) / (maxRatio - 1)) * height);
	let markerX = $derived(minAlpha === null ? null : minAlpha * width);
</script>

<div class="graph">
	<svg viewBox={`0 0 ${width} ${height}`} aria-label="Curva de contraste por alpha">
		<line x1="0" x2={width} y1={thresholdY} y2={thresholdY} class="threshold" />
		<polyline points={path} class="curve" />
		{#if markerX !== null}
			<line x1={markerX} x2={markerX} y1="0" y2={height} class="marker" />
			<circle cx={markerX} cy={thresholdY} r="5" class="dot" />
		{/if}
	</svg>

	<div class="legend">
		<span>0% alpha</span>
		<strong>Umbral AA {threshold.toFixed(1)}:1</strong>
		<span>100% alpha</span>
	</div>
</div>

<style>
	.graph {
		display: grid;
		gap: 0.8rem;
	}

	svg {
		width: 100%;
		height: auto;
		border-radius: 20px;
		background:
			linear-gradient(rgba(245, 240, 232, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(245, 240, 232, 0.03) 1px, transparent 1px),
			rgba(255, 255, 255, 0.015);
		background-size: 40px 40px;
		border: 1px solid var(--line);
	}

	.curve {
		fill: none;
		stroke: var(--cyan);
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.threshold {
		stroke: rgba(79, 110, 247, 0.95);
		stroke-width: 2;
		stroke-dasharray: 8 8;
	}

	.marker {
		stroke: rgba(35, 133, 109, 0.72);
		stroke-width: 2;
		stroke-dasharray: 5 6;
	}

	.dot {
		fill: var(--lime);
	}

	.legend {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		color: var(--ink-soft);
		font-size: 0.86rem;
	}

	strong {
		color: var(--ink-strong);
		font-weight: 600;
	}

	@media (max-width: 720px) {
		.legend {
			flex-direction: column;
		}
	}
</style>
