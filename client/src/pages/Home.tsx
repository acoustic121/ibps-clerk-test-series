import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildTest, getSyllabus } from "../api";
import type { ChapterSelector, ExamTrackKey, Syllabus } from "../types";

const TRACK_TABS: { key: ExamTrackKey; label: string; blurb: string }[] = [
  { key: "prelims", label: "Prelims", blurb: "Chapter-wise practice for the Prelims syllabus" },
  { key: "mains", label: "Mains", blurb: "Chapter-wise practice for the Mains syllabus" },
  { key: "real_prelims", label: "Real Prelims", blurb: "Actual previously-asked Prelims questions" },
  { key: "real_mains", label: "Real Mains", blurb: "Actual previously-asked Mains questions" },
];

function key(c: ChapterSelector) {
  return `${c.subject}::${c.chapter}`;
}

export default function Home() {
  const navigate = useNavigate();
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [track, setTrack] = useState<ExamTrackKey>("prelims");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [numQuestions, setNumQuestions] = useState(20);
  const [timed, setTimed] = useState(true);
  const [duration, setDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getSyllabus().then(setSyllabus).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setError(null);
    if (syllabus) setDuration(syllabus[track].durationMinutes);
  }, [track, syllabus]);

  const trackData = syllabus?.[track];

  const availableTotal = useMemo(() => {
    if (!trackData) return 0;
    let total = 0;
    for (const subject of trackData.subjects) {
      for (const chapter of subject.chapters) {
        if (selected.has(key({ subject: subject.name, chapter: chapter.name }))) {
          total += chapter.freshQuestions;
        }
      }
    }
    return total;
  }, [trackData, selected]);

  const selectedCount = selected.size;

  function toggleChapter(subject: string, chapter: string, available: number) {
    if (available === 0) return;
    const k = key({ subject, chapter });
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleSubjectAvailable(subjectName: string, chapters: { name: string; availableQuestions: number }[]) {
    const availableChapters = chapters.filter((c) => c.availableQuestions > 0);
    const allSelected = availableChapters.every((c) => selected.has(key({ subject: subjectName, chapter: c.name })));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of availableChapters) {
        const k = key({ subject: subjectName, chapter: c.name });
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function startTest() {
    if (selectedCount === 0) {
      setError("Pick at least one chapter to build your test.");
      return;
    }
    if (availableTotal === 0) {
      setError("None of the selected chapters have questions loaded yet.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const chapters: ChapterSelector[] = Array.from(selected).map((k) => {
        const [subject, chapter] = k.split("::");
        return { subject, chapter };
      });
      const session = await buildTest({
        examTrack: track,
        chapters,
        numQuestions,
        timed,
        durationMinutes: timed ? duration : undefined,
      });
      navigate(`/test/${session.testId}`, { state: { poolNotices: session.poolNotices } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  if (!syllabus) {
    return <div className="page-loading">Loading syllabus…</div>;
  }

  return (
    <div className="home-page">
      <section className="track-tabs">
        {TRACK_TABS.map((t) => (
          <button
            key={t.key}
            className={`track-tab ${track === t.key ? "selected" : ""}`}
            onClick={() => setTrack(t.key)}
          >
            <span className="track-tab-label">{t.label}</span>
            <span className="track-tab-blurb">{t.blurb}</span>
          </button>
        ))}
      </section>

      {trackData && trackData.subjects.length === 0 && (
        <div className="empty-state">
          No syllabus loaded for {TRACK_TABS.find((t) => t.key === track)?.label} yet. Provide the real
          previous-year question bank for this section to populate it.
        </div>
      )}

      <section className="chapter-grid">
        {trackData?.subjects.map((subject) => {
          const availableChapters = subject.chapters.filter((c) => c.availableQuestions > 0);
          const allSelected =
            availableChapters.length > 0 &&
            availableChapters.every((c) => selected.has(key({ subject: subject.name, chapter: c.name })));
          return (
            <div className="subject-card" key={subject.name}>
              <div className="subject-card-header">
                <h3>{subject.name}</h3>
                {availableChapters.length > 0 && (
                  <button className="link-btn" onClick={() => toggleSubjectAvailable(subject.name, subject.chapters)}>
                    {allSelected ? "Clear" : "Select all available"}
                  </button>
                )}
              </div>
              <ul className="chapter-list">
                {subject.chapters.map((chapter) => {
                  const k = key({ subject: subject.name, chapter: chapter.name });
                  const isSelected = selected.has(k);
                  const disabled = chapter.availableQuestions === 0;
                  return (
                    <li key={chapter.name}>
                      <label className={`chapter-item ${disabled ? "disabled" : ""} ${isSelected ? "checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggleChapter(subject.name, chapter.name, chapter.availableQuestions)}
                        />
                        <span className="chapter-name">{chapter.name}</span>
                        {disabled ? (
                          <span className="chapter-badge muted">coming soon</span>
                        ) : chapter.freshQuestions < chapter.availableQuestions ? (
                          <span className="chapter-badge fresh" title={`${chapter.availableQuestions} total, ${chapter.freshQuestions} not yet seen this cycle`}>
                            {chapter.freshQuestions}/{chapter.availableQuestions} fresh
                          </span>
                        ) : (
                          <span className="chapter-badge">{chapter.availableQuestions} Qs</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <aside className="build-bar">
        <div className="build-bar-row">
          <div className="build-stat">
            <strong>{selectedCount}</strong>
            <span>chapters selected</span>
          </div>
          <div className="build-stat">
            <strong>{availableTotal}</strong>
            <span>fresh questions available</span>
          </div>
          <div className="build-field">
            <label>Number of questions</label>
            <input
              type="number"
              min={1}
              max={Math.max(availableTotal, 1)}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
            />
          </div>
          <div className="build-field timer-field">
            <label>Timer</label>
            <div className="timer-toggle">
              <button className={timed ? "selected" : ""} onClick={() => setTimed(true)}>
                With timer
              </button>
              <button className={!timed ? "selected" : ""} onClick={() => setTimed(false)}>
                No timer
              </button>
            </div>
          </div>
          {timed && (
            <div className="build-field">
              <label>Duration (minutes)</label>
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          )}
          <button className="primary-btn start-btn" onClick={startTest} disabled={starting}>
            {starting ? "Starting…" : "Start Test"}
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </aside>
    </div>
  );
}
