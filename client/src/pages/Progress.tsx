import { useEffect, useState } from "react";
import { getProgress } from "../api";
import type { ProgressFilters, ProgressResponse } from "../types";
import TrendLineChart from "../components/TrendLineChart";
import GroupedBarChart from "../components/GroupedBarChart";
import HorizontalBarChart from "../components/HorizontalBarChart";

const SCORE_COLOR = "#2a78d6"; // categorical slot 1 (blue) - reserved for "Score %" everywhere
const ACCURACY_COLOR = "#eb6834"; // categorical slot 2 (orange) - reserved for "Accuracy %" everywhere

const TRACK_LABEL: Record<string, string> = {
  prelims: "Prelims",
  mains: "Mains",
  real_prelims: "Real Prelims",
  real_mains: "Real Mains",
};

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Progress() {
  const [filters, setFilters] = useState<ProgressFilters>({});
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgress(filters)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [filters]);

  if (error) return <div className="page-loading error-text">{error}</div>;
  if (!data) return <div className="page-loading">Loading progress…</div>;

  const { totals, timeSeries, subjectStats, chapterStats, availableFilters } = data;

  if (totals.totalAttempts === 0 && Object.values(filters).every((v) => !v)) {
    return (
      <div className="empty-state">
        No attempts yet. Build and submit a test first, then your progress will show up here.
      </div>
    );
  }

  const chapterOptions = filters.subject ? availableFilters.chaptersBySubject[filters.subject] ?? [] : [];

  return (
    <div className="progress-page">
      <section className="filter-bar">
        <div className="build-field">
          <label>Month</label>
          <select
            value={filters.month ?? "all"}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value === "all" ? undefined : e.target.value }))}
          >
            <option value="all">All time</option>
            {availableFilters.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="build-field">
          <label>Exam track</label>
          <select
            value={filters.examTrack ?? "all"}
            onChange={(e) => setFilters((f) => ({ ...f, examTrack: e.target.value === "all" ? undefined : e.target.value }))}
          >
            <option value="all">All tracks</option>
            {availableFilters.examTracks.map((t) => (
              <option key={t} value={t}>
                {TRACK_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </div>

        <div className="build-field">
          <label>Subject</label>
          <select
            value={filters.subject ?? "all"}
            onChange={(e) =>
              setFilters((f) => ({ ...f, subject: e.target.value === "all" ? undefined : e.target.value, chapter: undefined }))
            }
          >
            <option value="all">All subjects</option>
            {availableFilters.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="build-field">
          <label>Chapter</label>
          <select
            value={filters.chapter ?? "all"}
            disabled={!filters.subject}
            onChange={(e) => setFilters((f) => ({ ...f, chapter: e.target.value === "all" ? undefined : e.target.value }))}
          >
            <option value="all">All chapters</option>
            {chapterOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="build-field">
          <label>Timer</label>
          <select
            value={filters.timed ?? "all"}
            onChange={(e) => setFilters((f) => ({ ...f, timed: e.target.value === "all" ? undefined : e.target.value }))}
          >
            <option value="all">Timed &amp; untimed</option>
            <option value="timed">Timed only</option>
            <option value="untimed">Untimed only</option>
          </select>
        </div>
      </section>

      <section className="stat-tiles">
        <div className="stat-tile">
          <strong>{totals.totalAttempts}</strong>
          <span>Attempts</span>
        </div>
        <div className="stat-tile">
          <strong>{totals.totalQuestions}</strong>
          <span>Questions</span>
        </div>
        <div className="stat-tile" style={{ color: SCORE_COLOR }}>
          <strong>{totals.overallScorePct}%</strong>
          <span>Overall score</span>
        </div>
        <div className="stat-tile" style={{ color: ACCURACY_COLOR }}>
          <strong>{totals.overallAccuracyPct}%</strong>
          <span>Overall accuracy</span>
        </div>
      </section>

      <section className="chart-card">
        <h3>Score &amp; accuracy trend</h3>
        {timeSeries.length === 0 ? (
          <div className="chart-empty">No attempts match these filters.</div>
        ) : (
          <TrendLineChart
            series={[
              { key: "score", label: "Score %", color: SCORE_COLOR, points: timeSeries.map((t) => ({ x: dateLabel(t.date), y: t.scorePct })) },
              {
                key: "accuracy",
                label: "Accuracy %",
                color: ACCURACY_COLOR,
                points: timeSeries.map((t) => ({ x: dateLabel(t.date), y: t.accuracyPct })),
              },
            ]}
          />
        )}
      </section>

      <section className="chart-card">
        <h3>Subject-wise comparison</h3>
        <GroupedBarChart
          groups={subjectStats.map((s) => ({
            label: s.subject,
            values: { score: s.scorePct, accuracy: s.accuracyPct },
            meta: `${s.totalQuestions} Qs`,
          }))}
          seriesDefs={[
            { key: "score", label: "Score %", color: SCORE_COLOR },
            { key: "accuracy", label: "Accuracy %", color: ACCURACY_COLOR },
          ]}
        />
      </section>

      <section className="chart-card">
        <h3>Chapter-wise weak areas</h3>
        <p className="chart-subtitle">Ranked weakest first by accuracy</p>
        <HorizontalBarChart
          items={chapterStats.map((c) => ({ label: c.chapter ?? "", value: c.accuracyPct, color: ACCURACY_COLOR }))}
        />

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Chapter</th>
                <th>Questions</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Skipped</th>
                <th>Accuracy</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {chapterStats.map((c) => (
                <tr key={`${c.subject}::${c.chapter}`}>
                  <td>{c.subject}</td>
                  <td>{c.chapter}</td>
                  <td>{c.totalQuestions}</td>
                  <td>{c.correct}</td>
                  <td>{c.wrong}</td>
                  <td>{c.skipped}</td>
                  <td>{c.accuracyPct}%</td>
                  <td>{c.scorePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
