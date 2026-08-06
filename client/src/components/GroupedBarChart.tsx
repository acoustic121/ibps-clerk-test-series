import { useState } from "react";

export interface BarSeriesDef {
  key: string;
  label: string;
  color: string;
}

export interface BarGroup {
  label: string;
  values: Record<string, number>;
  meta?: string;
}

interface Props {
  groups: BarGroup[];
  seriesDefs: BarSeriesDef[];
  height?: number;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;

export default function GroupedBarChart({ groups, seriesDefs, height = 260 }: Props) {
  const [hover, setHover] = useState<{ x: number; label: string; items: { label: string; value: number; color: string }[] } | null>(
    null
  );

  const width = 640;
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  if (groups.length === 0) {
    return <div className="chart-empty">No data for this filter yet.</div>;
  }

  const groupW = plotW / groups.length;
  const barGap = 3;
  const barW = Math.max((groupW - barGap * (seriesDefs.length + 1)) / seriesDefs.length, 6);
  const yAt = (v: number) => PAD_TOP + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Subject-wise comparison">
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={yAt(g)} y2={yAt(g)} className="chart-gridline" />
            <text x={PAD_LEFT - 8} y={yAt(g)} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
              {g}%
            </text>
          </g>
        ))}

        {groups.map((grp, gi) => {
          const groupX = PAD_LEFT + gi * groupW;
          return (
            <g key={grp.label}>
              {seriesDefs.map((s, si) => {
                const val = grp.values[s.key] ?? 0;
                const x = groupX + barGap + si * (barW + barGap);
                const y = yAt(val);
                const barH = PAD_TOP + plotH - y;
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barH, 0)}
                    rx={3}
                    fill={s.color}
                    onMouseEnter={() =>
                      setHover({
                        x: groupX + groupW / 2,
                        label: grp.label,
                        items: seriesDefs.map((sd) => ({ label: sd.label, value: grp.values[sd.key] ?? 0, color: sd.color })),
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
              <text x={groupX + groupW / 2} y={height - 24} className="chart-axis-label" textAnchor="middle">
                {grp.label}
              </text>
              {grp.meta && (
                <text x={groupX + groupW / 2} y={height - 10} className="chart-axis-label muted-label" textAnchor="middle">
                  {grp.meta}
                </text>
              )}
            </g>
          );
        })}
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
        {seriesDefs.map((s) => (
          <div key={s.key} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
