// Plain SVG bar chart — no charting library needed for a simple 30-point series.
export function BarChart({
  data, valueFormatter, color = "#0F1620", height = 160,
}: {
  data: { label: string; value: number }[];
  valueFormatter?: (v: number) => string;
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-40 w-full">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 10);
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              fill={color}
              rx={0.5}
            >
              <title>{`${d.label}: ${valueFormatter ? valueFormatter(d.value) : d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-navy/40">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
