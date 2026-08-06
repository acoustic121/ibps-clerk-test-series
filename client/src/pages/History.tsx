import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSeries, reattempt } from "../api";
import type { SeriesInfo } from "../types";

const TRACK_LABEL: Record<string, string> = {
  prelims: "Prelims",
  mains: "Mains",
  real_prelims: "Real Prelims",
  real_mains: "Real Mains",
};

const SCORE_COLOR = "#2a78d6"; // same "Score %" color used on the Progress page

function scorePct(score: number, totalMarks: number) {
  return totalMarks > 0 ? Math.max(0, Math.min(100, (score / totalMarks) * 100)) : 0;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 120;
  const height = 32;
  const pad = 4;
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className="sparkline">
        <circle cx={width / 2} cy={height / 2} r={3} fill={SCORE_COLOR} />
      </svg>
    );
  }
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const xAt = (i: number) => pad + (plotW * i) / (values.length - 1);
  const yAt = (v: number) => pad + plotH - (v / 100) * plotH;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return (
    <svg width={width} height={height} className="sparkline">
      <path d={d} stroke={SCORE_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2.5} fill={SCORE_COLOR} />
      ))}
    </svg>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [series, setSeries] = useState<SeriesInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reattempting, setReattempting] = useState<string | null>(null);

  useEffect(() => {
    getSeries().then(setSeries).catch((e) => setError(e.message));
  }, []);

  async function handleReattempt(anyAttemptId: string) {
    setReattempting(anyAttemptId);
    setError(null);
    try {
      const session = await reattempt(anyAttemptId);
      navigate(`/test/${session.testId}`, { state: { poolNotices: session.poolNotices } });
    } catch (e: any) {
      setError(e.message);
      setReattempting(null);
    }
  }

  if (error) return <div className="page-loading error-text">{error}</div>;
  if (!series) return <div className="page-loading">Loading history…</div>;

  if (series.length === 0) {
    return <div className="empty-state">No tests attempted yet. Build a test to get started.</div>;
  }

  return (
    <div className="history-page series-page">
      <h2>Test history</h2>
      {series.map((s) => {
        const latestAttemptId = s.attempts[s.attempts.length - 1].id;
        return (
          <div className="series-card" key={s.seriesId}>
            <div className="series-card-header">
              <div>
                <div className="series-title">
                  {TRACK_LABEL[s.examTrack] ?? s.examTrack} · {s.chapters.map((c) => c.chapter).join(", ")}
                </div>
                <div className="series-meta">
                  {s.totalQuestions} questions · {s.totalMarks} marks · first attempted{" "}
                  {new Date(s.firstAttemptAt).toLocaleDateString()}
                </div>
              </div>
              <button
                className="primary-btn"
                disabled={reattempting === latestAttemptId}
                onClick={() => handleReattempt(latestAttemptId)}
              >
                {reattempting === latestAttemptId ? "Starting…" : "Re-attempt"}
              </button>
            </div>

            <div className="series-progress-row">
              <Sparkline values={s.attempts.map((a) => scorePct(a.score, s.totalMarks))} />
              <div className="series-progress-stats">
                <div>
                  <strong>{s.attemptsCount}</strong>
                  <span>attempt{s.attemptsCount > 1 ? "s" : ""}</span>
                </div>
                <div>
                  <strong>{s.bestScore}</strong>
                  <span>best score</span>
                </div>
                <div>
                  <strong>{s.latestScore}</strong>
                  <span>latest score</span>
                </div>
              </div>
            </div>

            <table className="series-attempts-table">
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Wrong</th>
                  <th>Skipped</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {s.attempts.map((a, i) => (
                  <tr key={a.id}>
                    <td>#{i + 1}</td>
                    <td>{new Date(a.submittedAt).toLocaleString()}</td>
                    <td>
                      {a.score} / {s.totalMarks}
                    </td>
                    <td>{a.correctCount}</td>
                    <td>{a.wrongCount}</td>
                    <td>{a.skippedCount}</td>
                    <td>
                      <Link className="link-btn" to={`/results/${a.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
