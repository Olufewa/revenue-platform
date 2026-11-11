interface LineChartProps {
  /** One value per day, oldest first. */
  current: number[];
  /** The period before, drawn dashed for comparison. */
  previous?: number[];
  /** The value at the top of the chart. */
  max: number;
  /** What the chart shows, for screen readers. */
  label: string;
}

const WIDTH = 600;
const HEIGHT = 200;

/** Turns values into SVG points: x across the width, y up from the bottom. */
function toPoints(values: number[], max: number): string {
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = HEIGHT - (max > 0 ? (value / max) * (HEIGHT - 10) : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** A line chart drawn by hand in SVG: gridlines, a shaded line, a dashed one. */
export function LineChart({ current, previous, max, label }: LineChartProps) {
  const line = toPoints(current, max);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="block h-60 w-full"
    >
      {[0.5, HEIGHT / 3, (HEIGHT * 2) / 3].map((y) => (
        <line
          key={y}
          x1="0"
          x2={WIDTH}
          y1={y}
          y2={y}
          className="stroke-grid"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1="0"
        x2={WIDTH}
        y1={HEIGHT - 0.5}
        y2={HEIGHT - 0.5}
        className="stroke-line-strong"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${line} ${WIDTH},${HEIGHT} 0,${HEIGHT}`}
        className="fill-gold opacity-25"
      />
      {previous && (
        <polyline
          points={toPoints(previous, max)}
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="stroke-ink-faint"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={line}
        fill="none"
        strokeWidth="2"
        className="stroke-ink"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
