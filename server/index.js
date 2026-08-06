import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadAllQuestions, buildSyllabusWithCounts } from "./lib/loadQuestions.js";
import { scoreTest } from "./lib/scoring.js";
import { buildProgress, buildAvailableFilters } from "./lib/progress.js";
import { getUsedByKey, selectEligiblePool, recordAttemptUsage } from "./lib/usage.js";
import { buildSeriesList } from "./lib/series.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATTEMPTS_PATH = path.join(__dirname, "data", "attempts.json");
const IMAGES_DIR = path.join(__dirname, "data", "images");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/images", express.static(IMAGES_DIR));

let ALL_QUESTIONS = loadAllQuestions();
const sessions = new Map();

function readAttempts() {
  if (!fs.existsSync(ATTEMPTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ATTEMPTS_PATH, "utf-8"));
}

function writeAttempts(attempts) {
  fs.writeFileSync(ATTEMPTS_PATH, JSON.stringify(attempts, null, 2));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeQuestion(q) {
  return {
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    passage: q.passage,
    questionText: q.questionText,
    options: q.options,
    hasImage: q.hasImage,
    imagePath: q.hasImage ? `/images/${q.imageFile}` : null,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
  };
}

app.get("/api/syllabus", (req, res) => {
  res.json(buildSyllabusWithCounts(ALL_QUESTIONS));
});

app.post("/api/reload", (req, res) => {
  ALL_QUESTIONS = loadAllQuestions();
  res.json({ ok: true, totalQuestions: ALL_QUESTIONS.length });
});

app.post("/api/tests", (req, res) => {
  const { examTrack, chapters, numQuestions, timed, durationMinutes } = req.body;
  if (!examTrack || !Array.isArray(chapters) || chapters.length === 0) {
    return res.status(400).json({ error: "examTrack and at least one chapter are required" });
  }
  const usedByKey = getUsedByKey();
  const { pool, perChapter } = selectEligiblePool(chapters, examTrack, ALL_QUESTIONS, usedByKey);

  if (pool.length === 0) {
    return res.status(400).json({ error: "No questions available for the selected chapters yet" });
  }

  const requested = Math.max(1, Number(numQuestions) || pool.length);
  const actual = Math.min(requested, pool.length);
  const selected = shuffle(pool).slice(0, actual);

  const notices = [];
  if (actual < requested) {
    notices.push(
      `Only ${pool.length} question(s) not yet seen this cycle across your selected chapters — serving ${actual} instead of ${requested}.`
    );
  }
  const selectedIds = new Set(selected.map((q) => q.id));
  for (const pc of perChapter) {
    if (pc.unusedIds.length > 0 && pc.unusedIds.every((id) => selectedIds.has(id))) {
      notices.push(`${pc.chapterLabel}: this test uses up all of this chapter's remaining fresh questions — the next one will start a new cycle.`);
    }
  }

  const testId = crypto.randomUUID();
  sessions.set(testId, {
    id: testId,
    seriesId: testId, // a fresh build roots a brand new series; re-attempts inherit this id
    examTrack,
    chapters,
    timed: Boolean(timed),
    durationMinutes: timed ? Number(durationMinutes) || 30 : null,
    createdAt: new Date().toISOString(),
    questions: selected,
  });

  res.json({
    testId,
    examTrack,
    chapters,
    timed: Boolean(timed),
    durationMinutes: timed ? Number(durationMinutes) || 30 : null,
    requestedCount: requested,
    actualCount: actual,
    poolNotices: notices,
    questions: selected.map(sanitizeQuestion),
  });
});

app.post("/api/attempts/:id/reattempt", (req, res) => {
  const attempts = readAttempts();
  const original = attempts.find((a) => a.id === req.params.id);
  if (!original) return res.status(404).json({ error: "Attempt not found" });

  const byId = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
  const questions = original.details.map((d) => byId.get(d.questionId)).filter(Boolean);
  if (questions.length === 0) {
    return res.status(400).json({ error: "None of this series' questions could be found anymore" });
  }

  const shuffled = shuffle(questions);
  const testId = crypto.randomUUID();
  sessions.set(testId, {
    id: testId,
    seriesId: original.seriesId || original.id,
    examTrack: original.examTrack,
    chapters: original.chapters,
    timed: original.timed,
    durationMinutes: original.durationMinutes,
    createdAt: new Date().toISOString(),
    questions: shuffled,
  });

  res.json({
    testId,
    examTrack: original.examTrack,
    chapters: original.chapters,
    timed: original.timed,
    durationMinutes: original.durationMinutes,
    requestedCount: questions.length,
    actualCount: questions.length,
    poolNotices:
      questions.length < original.details.length
        ? [`${original.details.length - questions.length} question(s) from this series are no longer available and were skipped.`]
        : [],
    questions: shuffled.map(sanitizeQuestion),
  });
});

app.get("/api/tests/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Test session not found" });
  res.json({
    testId: session.id,
    examTrack: session.examTrack,
    chapters: session.chapters,
    timed: session.timed,
    durationMinutes: session.durationMinutes,
    requestedCount: session.questions.length,
    actualCount: session.questions.length,
    questions: session.questions.map(sanitizeQuestion),
  });
});

app.post("/api/tests/:id/submit", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Test session not found" });
  const { answers = {}, timeTakenSeconds = null } = req.body;

  const result = scoreTest(session.questions, answers);
  const attemptId = crypto.randomUUID();
  const attemptRecord = {
    id: attemptId,
    testId: session.id,
    seriesId: session.seriesId,
    examTrack: session.examTrack,
    chapters: session.chapters,
    timed: session.timed,
    durationMinutes: session.durationMinutes,
    timeTakenSeconds,
    submittedAt: new Date().toISOString(),
    ...result,
  };

  const attempts = readAttempts();
  attempts.unshift(attemptRecord);
  writeAttempts(attempts);
  recordAttemptUsage(result.details, ALL_QUESTIONS);

  res.json(attemptRecord);
});

app.get("/api/attempts", (req, res) => {
  const attempts = readAttempts();
  res.json(
    attempts.map((a) => ({
      id: a.id,
      examTrack: a.examTrack,
      chapters: a.chapters,
      submittedAt: a.submittedAt,
      score: a.score,
      totalMarks: a.totalMarks,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      totalQuestions: a.totalQuestions,
      timed: a.timed,
      timeTakenSeconds: a.timeTakenSeconds,
    }))
  );
});

app.get("/api/series", (req, res) => {
  res.json(buildSeriesList(readAttempts()));
});

app.get("/api/progress", (req, res) => {
  const attempts = readAttempts();
  const { examTrack, timed, month, subject, chapter } = req.query;
  const progress = buildProgress(attempts, { examTrack, timed, month, subject, chapter });
  const availableFilters = buildAvailableFilters(attempts);
  res.json({ ...progress, availableFilters });
});

app.get("/api/attempts/:id", (req, res) => {
  const attempts = readAttempts();
  const attempt = attempts.find((a) => a.id === req.params.id);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  res.json(attempt);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Test Series server running on http://localhost:${PORT}`);
  console.log(`Loaded ${ALL_QUESTIONS.length} questions`);
});
