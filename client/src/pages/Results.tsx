import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAttempt } from "../api";
import { FormattedText } from "../components/FormattedText";
import type { AttemptResult } from "../types";

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function Results() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSolutions, setShowSolutions] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    getAttempt(attemptId).then(setAttempt).catch((e) => setError(e.message));
  }, [attemptId]);

  if (error) return <div className="page-loading error-text">{error}</div>;
  if (!attempt) return <div className="page-loading">Loading results…</div>;

  const accuracy =
    attempt.correctCount + attempt.wrongCount > 0
      ? Math.round((attempt.correctCount / (attempt.correctCount + attempt.wrongCount)) * 100)
      : 0;

  return (
    <div className="results-page">
      <section className="score-summary">
        <div className="score-hero">
          <div className="score-value">{attempt.score}</div>
          <div className="score-max">/ {attempt.totalMarks} marks</div>
        </div>
        <div className="score-stats">
          <div className="stat correct">
            <strong>{attempt.correctCount}</strong>
            <span>Correct</span>
          </div>
          <div className="stat wrong">
            <strong>{attempt.wrongCount}</strong>
            <span>Wrong</span>
          </div>
          <div className="stat skipped">
            <strong>{attempt.skippedCount}</strong>
            <span>Skipped</span>
          </div>
          <div className="stat">
            <strong>{accuracy}%</strong>
            <span>Accuracy</span>
          </div>
          <div className="stat">
            <strong>{formatDuration(attempt.timeTakenSeconds)}</strong>
            <span>Time taken</span>
          </div>
        </div>
      </section>

      <section className="section-wise">
        <h3>Section-wise breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Score</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Skipped</th>
            </tr>
          </thead>
          <tbody>
            {attempt.sectionWise.map((s) => (
              <tr key={s.subject}>
                <td>{s.subject}</td>
                <td>
                  {s.score} / {s.totalMarks}
                </td>
                <td>{s.correct}</td>
                <td>{s.wrong}</td>
                <td>{s.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button className="primary-btn" onClick={() => setShowSolutions((v) => !v)}>
        {showSolutions ? "Hide detailed solutions" : "View detailed solutions"}
      </button>

      {showSolutions && (
        <section className="solutions-list">
          {attempt.details.map((d, i) => (
            <div key={d.questionId} className={`solution-card ${d.status}`}>
              <div className="solution-head">
                <span className="q-number">Q{i + 1}.</span>
                <span className="solution-chapter">
                  {d.subject} · {d.chapter}
                </span>
                <span className={`status-badge ${d.status}`}>{d.status}</span>
                <span className="marks-note">{d.marksAwarded >= 0 ? `+${d.marksAwarded}` : d.marksAwarded}</span>
              </div>
              {d.passage && <p className="passage-panel small"><FormattedText text={d.passage} /></p>}
              {(() => {
                const optVals = Object.values(d.options);
                const hasOnlyI = /^only\s+i{1,3}$/i.test((optVals[0] ?? "").trim()) || (optVals[0] ?? "").toLowerCase().includes("only i");
                if (!hasOnlyI) return null;
                const txt = d.questionText ?? "";
                let dir = null;
                if (/^<b>[A-Z][a-z\s]+<\/b>\s*\n/.test(txt) || /^[A-Z][a-z]+\s*\n\s*\nI\./.test(txt)) {
                  dir = "In which of the following sentences is the highlighted word/phrase used correctly?";
                } else if (/\n\s*(I|II|III)[\.\)]\s/.test(txt) && /<b>/.test(txt)) {
                  dir = "Which of the following options can replace the highlighted word/phrase without changing the meaning of the sentence?";
                } else if (/\n\s*I+[\.\)]\s/.test(txt)) {
                  dir = "Which of the following sentences is/are grammatically correct and contextually meaningful?";
                }
                return dir ? (
                  <div className="question-direction-box">
                    <strong>Directions:</strong> {dir}
                  </div>
                ) : null;
              })()}
              <p className="question-text">
                {(d.chapter === "Spotting Errors" || d.chapter === "Error Detection") ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: (d.questionText ?? "")
                        .replace(/\n/g, "<br/>")
                        .replace(
                          /\(([ABCDE])\)\s*\/\s*/g,
                          (_m: string, l: string) => `<span class="se-part-badge">${l}</span>`
                        )
                        .replace(
                          /\(([ABCDE])\)\.?\s*$/g,
                          (_m: string, l: string) => `<span class="se-part-badge">${l}</span>`
                        ),
                    }}
                  />
                ) : (
                  <FormattedText text={d.questionText} />
                )}
              </p>
              {d.hasImage && <p className="muted">(figure-based question)</p>}
              <div className="options-list">
                {Object.entries(d.options).map(([letter, text]) => {
                  const isCorrect = letter === d.correctOption;
                  const isYours = letter === d.userAnswer;
                  const cls = isCorrect ? "correct" : isYours ? "wrong" : "";
                  return (
                    <div key={letter} className={`option-item static ${cls}`}>
                      <span className="option-letter">{letter.toUpperCase()}</span>
                      <span className="option-text">
                        <FormattedText text={
                          (d.chapter === "Spotting Errors" || d.chapter === "Error Detection") &&
                          /^\(?[ABCD]\)?$/.test((Object.values(d.options)[0] ?? "").trim())
                            ? (() => {
                                const clean = text.replace(/[()]/g, "").trim();
                                return ["A","B","C","D"].includes(clean) ? `Error is in Part ${clean}` : text;
                              })()
                            : text
                        } />
                      </span>
                      {isCorrect && <span className="tag">Correct answer</span>}
                      {isYours && !isCorrect && <span className="tag">Your answer</span>}
                    </div>
                  );
                })}
              </div>
              <div className="solution-text">
                <strong>Solution: </strong>
                <FormattedText text={d.solutionText} />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
