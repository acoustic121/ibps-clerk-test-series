export interface HBarItem {
  label: string;
  sublabel?: string;
  value: number;
  color: string;
}

interface Props {
  items: HBarItem[];
  barHeight?: number;
}

const LABEL_W = 190;
const VALUE_W = 44;
const ROW_GAP = 6;

export default function HorizontalBarChart({ items, barHeight = 20 }: Props) {
  if (items.length === 0) {
    return <div className="chart-empty">No data for this filter yet.</div>;
  }

  const width = 640;
  const plotW = width - LABEL_W - VALUE_W;
  const rowH = barHeight + ROW_GAP;
  const height = items.length * rowH + ROW_GAP;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg hbar" role="img" aria-label="Chapter-wise accuracy ranking">
      {items.map((item, i) => {
        const y = i * rowH + ROW_GAP;
        const barW = (Math.max(0, Math.min(100, item.value)) / 100) * plotW;
        return (
          <g key={item.label}>
            <text x={LABEL_W - 10} y={y + barHeight / 2} textAnchor="end" dominantBaseline="middle" className="chart-row-label">
              {item.label}
            </text>
            <rect x={LABEL_W} y={y} width={plotW} height={barHeight} rx={4} className="chart-track" />
            <rect x={LABEL_W} y={y} width={Math.max(barW, 2)} height={barHeight} rx={4} fill={item.color} />
            <text x={LABEL_W + plotW + 8} y={y + barHeight / 2} dominantBaseline="middle" className="chart-row-value">
              {item.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
