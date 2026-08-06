import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getTest, submitTest } from "../api";
import type { TestSession } from "../types";

type QStatus = "not-visited" | "answered" | "not-answered" | "marked" | "marked-answered";

import { FormattedText } from "../components/FormattedText";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function TestRunner() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [poolNotices, setPoolNotices] = useState<string[]>(
    (location.state as { poolNotices?: string[] } | null)?.poolNotices ?? []
  );
  const [session, setSession] = useState<TestSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentQuestion = session?.questions[index] ?? null;

  useEffect(() => {
    if (!testId) return;
    getTest(testId)
      .then((res) => {
        setSession(res);
        if (res.durationMinutes && res.durationMinutes > 0) {
          setSecondsLeft(res.durationMinutes * 60);
        }
      })
      .catch((err) => setError(err.message || "Failed to load test"));
  }, [testId]);

  useEffect(() => {
    if (currentQuestion) {
      setVisited((prev) => new Set(prev).add(currentQuestion.id));
    }
  }, [currentQuestion]);

  const startedAt = useRef<number>(Date.now());
  const autoSubmitted = useRef(false);

  const doSubmit = useCallback(async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    const timeTaken = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const result = await submitTest(session.testId, answers, timeTaken);
      navigate(`/results/${result.id}`, { replace: true });
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }, [session, answers, submitting, navigate]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        doSubmit();
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, doSubmit]);

  const statusOf = useCallback(
    (qid: string): QStatus => {
      const isMarked = marked.has(qid);
      const isAnswered = Boolean(answers[qid]);
      if (isMarked && isAnswered) return "marked-answered";
      if (isMarked) return "marked";
      if (isAnswered) return "answered";
      if (visited.has(qid)) return "not-answered";
      return "not-visited";
    },
    [marked, answers, visited]
  );

  const attemptedCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  if (error) return <div className="page-loading error-text">{error}</div>;
  if (!session || !currentQuestion) return <div className="page-loading">Loading test…</div>;

  const options = Object.entries(currentQuestion.options);

  // For Spotting Errors: options like (A),(B),(C),(D) mean "Error is in part X"
  const isSpottingErrorsStyle =
    currentQuestion.chapter === "Spotting Errors" ||
    currentQuestion.chapter === "Error Detection";
  const partRefOptions = /^\(?[ABCD]\)?$/.test(
    (options[0]?.[1] ?? "").trim()
  );

  function formatOptionText(optText: string): string {
    if (isSpottingErrorsStyle && partRefOptions) {
      const clean = optText.replace(/[()]/g, "").trim();
      if (["A", "B", "C", "D"].includes(clean))
        return `Error is in Part ${clean}`;
    }
    return optText;
  }

  // Render sentence with (A)/ markers as styled parts
  function formatSpottingErrorQuestion(text: string): string {
    if (!isSpottingErrorsStyle) return text;
    // Replace (A)/ (B)/ (C)/ (D) segment markers with line-break + badge
    return text
      .replace(
        /\(([ABCDE])\)\s*\/\s*/g,
        (_m: string, letter: string) =>
          `<span class="se-part-badge">${letter}</span>`
      )
      .replace(
        /\(([ABCDE])\)\.?\s*$/g,
        (_m: string, letter: string) =>
          `<span class="se-part-badge">${letter}</span>`
      );
  }

  return (
    <div className="runner">
      <div className="runner-header">
        <div className="runner-title">
          <strong>{currentQuestion.subject}</strong>
          <span> · {currentQuestion.chapter}</span>
        </div>
        <div className="runner-progress">
          Question {index + 1} of {session.questions.length}
        </div>
        {secondsLeft !== null && (
          <div className={`runner-timer ${secondsLeft < 60 ? "low" : ""}`}>{formatTime(secondsLeft)}</div>
        )}
        <button className="danger-btn" onClick={() => setConfirmOpen(true)}>
          Submit Test
        </button>
      </div>

      {poolNotices.length > 0 && (
        <div className="notice-banner">
          {poolNotices.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
          <button className="notice-dismiss" onClick={() => setPoolNotices([])}>
            ×
          </button>
        </div>
      )}

      <div className="runner-body">
        <div className="runner-main">
          {currentQuestion.passage && (
            <div className="passage-panel">
              <div className="passage-label">Passage</div>
              <p><FormattedText text={currentQuestion.passage} /></p>
            </div>
          )}
          <div className="question-panel">
            <div className="question-text">
              <span className="q-number">Q{index + 1}.</span>{" "}
              {isSpottingErrorsStyle ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: formatSpottingErrorQuestion(
                      (currentQuestion.questionText ?? "").replace(/\n/g, "<br/>")
                    ),
                  }}
                />
              ) : (
                <FormattedText text={currentQuestion.questionText} />
              )}
            </div>
            {currentQuestion.hasImage && currentQuestion.imagePath && (
              <img className="question-image" src={currentQuestion.imagePath} alt="question figure" />
            )}
            <div className="options-list">
              {options.map(([letter, text]) => {
                const isSelected = answers[currentQuestion.id] === letter;
                return (
                  <label key={letter} className={`option-item ${isSelected ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      checked={isSelected}
                      onChange={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }))}
                    />
                    <span className="option-letter">{letter.toUpperCase()}</span>
                    <span className="option-text"><FormattedText text={formatOptionText(text)} /></span>
                  </label>
                );
              })}
            </div>
            <div className="marks-note">
              +{currentQuestion.marks} for correct · -{currentQuestion.negativeMarks} for wrong
            </div>
          </div>

          <div className="runner-controls">
            <button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Previous
            </button>
            <button
              onClick={() =>
                setAnswers((prev) => ({ ...prev, [currentQuestion.id]: null }))
              }
            >
              Clear Response
            </button>
            <button
              className="mark-btn"
              onClick={() => {
                setMarked((prev) => {
                  const next = new Set(prev);
                  if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
                  else next.add(currentQuestion.id);
                  return next;
                });
                setIndex((i) => Math.min(session.questions.length - 1, i + 1));
              }}
            >
              Mark for Review &amp; Next
            </button>
            <button
              className="primary-btn"
              disabled={index === session.questions.length - 1}
              onClick={() => setIndex((i) => Math.min(session.questions.length - 1, i + 1))}
            >
              Save &amp; Next
            </button>
          </div>
        </div>

        <aside className="palette-panel">
          <div className="palette-summary">
            <div>
              <span className="dot answered" /> Answered
            </div>
            <div>
              <span className="dot not-answered" /> Not answered
            </div>
            <div>
              <span className="dot marked" /> Marked for review
            </div>
            <div>
              <span className="dot not-visited" /> Not visited
            </div>
          </div>
          <div className="palette-grid">
            {session.questions.map((q, i) => (
              <button
                key={q.id}
                className={`palette-cell ${statusOf(q.id)} ${i === index ? "current" : ""}`}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="palette-attempted">
            {attemptedCount} / {session.questions.length} attempted
          </div>
        </aside>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Submit test?</h3>
            <p>
              You have attempted <strong>{attemptedCount}</strong> of <strong>{session.questions.length}</strong>{" "}
              questions. {session.questions.length - attemptedCount} will be left unanswered.
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmOpen(false)}>Keep reviewing</button>
              <button className="danger-btn" disabled={submitting} onClick={doSubmit}>
                {submitting ? "Submitting…" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
