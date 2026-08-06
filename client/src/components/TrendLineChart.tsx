import { useState } from "react";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  points: { x: string; y: number }[];
}

interface Props {
  series: TrendSeries[];
  height?: number;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export default function TrendLineChart({ series, height = 260 }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string; items: { label: string; value: number; color: string }[] } | null>(
    null
  );

  const pointCount = series[0]?.points.length ?? 0;
  const width = 640;
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  if (pointCount === 0) {
    return <div className="chart-empty">No data for this filter yet.</div>;
  }

  const xAt = (i: number) => PAD_LEFT + (pointCount === 1 ? plotW / 2 : (plotW * i) / (pointCount - 1));
  const yAt = (v: number) => PAD_TOP + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Score and accuracy trend over time">
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={yAt(g)} y2={yAt(g)} className="chart-gridline" />
            <text x={PAD_LEFT - 8} y={yAt(g)} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
              {g}%
            </text>
          </g>
        ))}

        {series[0].points.map((p, i) => (
          <text
            key={p.x}
            x={xAt(i)}
            y={height - 8}
            className="chart-axis-label"
            textAnchor={pointCount > 6 && i % Math.ceil(pointCount / 6) !== 0 ? "middle" : "middle"}
            opacity={pointCount > 8 ? (i % Math.ceil(pointCount / 8) === 0 ? 1 : 0) : 1}
          >
            {p.x}
          </text>
        ))}

        {series.map((s) => {
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.y)}`).join(" ");
          return (
            <g key={s.key}>
              <path d={d} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />
              ))}
              {s.points.length > 0 && (
                <text
                  x={xAt(s.points.length - 1) + 6}
                  y={yAt(s.points[s.points.length - 1].y)}
                  className="chart-direct-label"
                  dominantBaseline="middle"
                >
                  {s.points[s.points.length - 1].y}%
                </text>
              )}
            </g>
          );
        })}

        {series[0].points.map((p, i) => (
          <rect
            key={i}
            x={xAt(i) - plotW / pointCount / 2}
            y={PAD_TOP}
            width={Math.max(plotW / pointCount, 10)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() =>
              setHover({
                x: xAt(i),
                y: PAD_TOP,
                label: p.x,
                items: series.map((s) => ({ label: s.label, value: s.points[i]?.y ?? 0, color: s.color })),
              })
            }
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {hover && (
          <line x1={hover.x} x2={hover.x} y1={PAD_TOP} y2={height - PAD_BOTTOM} className="chart-crosshair" />
        )}
      </svg>

      {hover && (
        <div className="chart-tooltip" style={{ left: `${(hover.x / width) * 100}%` }}>
          <div className="chart-tooltip-title">{hover.label}</div>
          {hover.items.map((it) => (
            <div key={it.label} className="chart-tooltip-row">
              <span className="chart-tooltip-swatch" style={{ background: it.color }} />
              {it.label}: <strong>{it.value}%</strong>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {series.map((s) => (
          <div key={s.key} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
