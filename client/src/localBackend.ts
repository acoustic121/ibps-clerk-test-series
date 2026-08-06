import type {
  AttemptDetail,
  AttemptResult,
  AttemptSummary,
  ChapterSelector,
  ExamTrackKey,
  ProgressFilters,
  ProgressResponse,
  SeriesInfo,
  Syllabus,
  TestQuestion,
  TestSession,
} from "./types";

const ATTEMPTS_KEY = "ibps_clerk_attempts_v1";
const USAGE_KEY = "ibps_clerk_usage_v1";
const SESSIONS_KEY = "ibps_clerk_sessions_v1";

export const SUBJECT_FAMILY: Record<string, string> = {
  "Reasoning Ability": "reasoning",
  "Reasoning & Computer Aptitude": "reasoning",
  "Numerical Ability": "quant",
  "Quantitative Aptitude": "quant",
  "English Language": "english",
  "General & Financial Awareness": "general_awareness",
};

export function familyOf(subjectName: string): string {
  return SUBJECT_FAMILY[subjectName] ?? subjectName;
}

export function familyKey(subjectName: string, chapterName: string): string {
  return `${familyOf(subjectName)}::${chapterName}`;
}

let cachedQuestions: any[] | null = null;
let cachedSyllabus: Syllabus | null = null;

async function getRawData() {
  if (!cachedQuestions || !cachedSyllabus) {
    const baseUrl = import.meta.env.BASE_URL || "./";
    const cacheBuster = `?v=6630_${Date.now()}`;
    const [qRes, sRes] = await Promise.all([
      fetch(`${baseUrl}data/all_questions.json${cacheBuster}`),
      fetch(`${baseUrl}data/syllabus.json${cacheBuster}`),
    ]);
    cachedQuestions = await qRes.json();
    cachedSyllabus = await sRes.json();
  }
  return { questions: cachedQuestions!, syllabus: cachedSyllabus! };
}

function readStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to write to localStorage", e);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeQuestion(q: any): TestQuestion {
  const baseUrl = import.meta.env.BASE_URL || "./";
  const imagePath = q.hasImage && q.imageFile ? `${baseUrl}data/images/${q.imageFile}` : null;
  return {
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    passage: q.passage,
    questionText: q.questionText,
    options: q.options,
    hasImage: q.hasImage,
    imagePath,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
  };
}

export async function localGetSyllabus(): Promise<Syllabus> {
  const { questions, syllabus } = await getRawData();
  const counts = new Map<string, number>();

  for (const q of questions) {
    for (const track of q.examTracks || []) {
      const fk = `${track}::${familyKey(q.subject, q.chapter)}`;
      counts.set(fk, (counts.get(fk) || 0) + 1);
    }
  }

  const result: Syllabus = JSON.parse(JSON.stringify(syllabus));
  for (const trackKey of ["prelims", "mains", "real_prelims", "real_mains"] as const) {
    const trackObj = result[trackKey];
    if (!trackObj) continue;
    for (const subj of trackObj.subjects) {
      subj.chapters = subj.chapters.map((ch: any) => {
        const chName = typeof ch === "string" ? ch : ch.name;
        const fk = `${trackKey}::${familyKey(subj.name, chName)}`;
        const total = counts.get(fk) || 0;
        return {
          name: chName,
          availableQuestions: total,
          freshQuestions: total,
        };
      });
    }
  }
  return result;
}

export async function localBuildTest(params: {
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  numQuestions: number;
  timed: boolean;
  durationMinutes?: number;
}): Promise<TestSession> {
  const { questions } = await getRawData();
  const usedByKey: Record<string, string[]> = readStorage(USAGE_KEY, {});

  const pool: any[] = [];
  const notices: string[] = [];

  for (const ch of params.chapters) {
    const fk = familyKey(ch.subject, ch.chapter);
    const eligible = questions.filter(
      (q) =>
        q.examTracks.includes(params.examTrack) &&
        familyOf(q.subject) === familyOf(ch.subject) &&
        q.chapter === ch.chapter
    );
    const usedIds = new Set(usedByKey[fk] || []);
    let fresh = eligible.filter((q) => !usedIds.has(q.id));
    if (fresh.length === 0 && eligible.length > 0) {
      fresh = eligible; // cycle reset
    }
    pool.push(...fresh);
  }

  if (pool.length === 0) {
    throw new Error("No questions available for the selected chapters yet.");
  }

  const requested = Math.max(1, Number(params.numQuestions) || pool.length);
  const actual = Math.min(requested, pool.length);
  const selected = shuffle(pool).slice(0, actual);

  const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const sessionData = {
    id: testId,
    seriesId: testId,
    examTrack: params.examTrack,
    chapters: params.chapters,
    timed: Boolean(params.timed),
    durationMinutes: params.timed ? Number(params.durationMinutes) || 30 : null,
    createdAt: new Date().toISOString(),
    rawQuestions: selected,
  };

  const sessions = readStorage<Record<string, any>>(SESSIONS_KEY, {});
  sessions[testId] = sessionData;
  writeStorage(SESSIONS_KEY, sessions);

  return {
    testId,
    examTrack: params.examTrack,
    chapters: params.chapters,
    timed: Boolean(params.timed),
    durationMinutes: sessionData.durationMinutes,
    requestedCount: requested,
    actualCount: actual,
    poolNotices: notices,
    questions: selected.map(sanitizeQuestion),
  };
}

export async function localGetTest(testId: string): Promise<TestSession> {
  const sessions = readStorage<Record<string, any>>(SESSIONS_KEY, {});
  const session = sessions[testId];
  if (!session) throw new Error("Test session not found");
  return {
    testId: session.id,
    examTrack: session.examTrack,
    chapters: session.chapters,
    timed: session.timed,
    durationMinutes: session.durationMinutes,
    requestedCount: session.rawQuestions.length,
    actualCount: session.rawQuestions.length,
    questions: session.rawQuestions.map(sanitizeQuestion),
  };
}

export async function localSubmitTest(
  testId: string,
  answers: Record<string, string | null>,
  timeTakenSeconds: number | null
): Promise<AttemptResult> {
  const sessions = readStorage<Record<string, any>>(SESSIONS_KEY, {});
  const session = sessions[testId];
  if (!session) throw new Error("Test session not found");

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let score = 0;
  let totalMarks = 0;

  const details: AttemptDetail[] = session.rawQuestions.map((q: any) => {
    const given = answers[q.id] || null;
    const isCorrect = given === q.correctOption;
    const isSkipped = given === null;
    const isWrong = !isSkipped && !isCorrect;

    totalMarks += q.marks;
    if (isCorrect) {
      score += q.marks;
      correctCount++;
    } else if (isWrong) {
      score -= q.negativeMarks;
      wrongCount++;
    } else {
      skippedCount++;
    }

    const baseUrl = import.meta.env.BASE_URL || "./";
    return {
      questionId: q.id,
      subject: q.subject,
      chapter: q.chapter,
      passage: q.passage,
      questionText: q.questionText,
      options: q.options,
      correctOption: q.correctOption,
      userAnswer: given,
      status: isCorrect ? "correct" : isWrong ? "wrong" : "skipped",
      marksAwarded: isCorrect ? q.marks : isWrong ? -q.negativeMarks : 0,
      solutionText: q.solutionText,
      hasImage: q.hasImage,
      imagePath: q.hasImage && q.imageFile ? `${baseUrl}data/images/${q.imageFile}` : null,
    };
  });

  const attemptId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const attemptRecord: AttemptResult = {
    id: attemptId,
    testId: session.id,
    examTrack: session.examTrack,
    chapters: session.chapters,
    timed: session.timed,
    durationMinutes: session.durationMinutes,
    timeTakenSeconds,
    submittedAt: new Date().toISOString(),
    score: Math.round(score * 100) / 100,
    totalMarks,
    correctCount,
    wrongCount,
    skippedCount,
    totalQuestions: session.rawQuestions.length,
    sectionWise: [],
    details,
  };

  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);
  attempts.unshift(attemptRecord);
  writeStorage(ATTEMPTS_KEY, attempts);

  const usedByKey: Record<string, string[]> = readStorage(USAGE_KEY, {});
  for (const d of details) {
    const fk = familyKey(d.subject, d.chapter);
    if (!usedByKey[fk]) usedByKey[fk] = [];
    if (!usedByKey[fk].includes(d.questionId)) {
      usedByKey[fk].push(d.questionId);
    }
  }
  writeStorage(USAGE_KEY, usedByKey);

  return attemptRecord;
}

export async function localListAttempts(): Promise<AttemptSummary[]> {
  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);
  return attempts.map((a) => ({
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
  }));
}

export async function localGetAttempt(id: string): Promise<AttemptResult> {
  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);
  const attempt = attempts.find((a) => a.id === id);
  if (!attempt) throw new Error("Attempt not found");
  return attempt;
}

export async function localGetSeries(): Promise<SeriesInfo[]> {
  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);
  const map = new Map<string, AttemptResult[]>();
  for (const a of attempts) {
    const key = a.testId || a.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  const result: SeriesInfo[] = [];
  for (const [seriesId, list] of map.entries()) {
    list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    const bestScore = Math.max(...list.map((l) => l.score));
    const latestScore = list[list.length - 1].score;

    result.push({
      seriesId,
      examTrack: list[0].examTrack,
      chapters: list[0].chapters,
      totalMarks: list[0].totalMarks,
      totalQuestions: list[0].totalQuestions,
      timed: list[0].timed,
      attemptsCount: list.length,
      bestScore,
      latestScore,
      firstAttemptAt: list[0].submittedAt,
      lastAttemptAt: list[list.length - 1].submittedAt,
      attempts: list.map((a) => ({
        id: a.id,
        submittedAt: a.submittedAt,
        score: a.score,
        correctCount: a.correctCount,
        wrongCount: a.wrongCount,
        skippedCount: a.skippedCount,
        timeTakenSeconds: a.timeTakenSeconds,
      })),
    });
  }
  return result;
}

export async function localReattempt(attemptId: string): Promise<TestSession> {
  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);
  const orig = attempts.find((a) => a.id === attemptId);
  if (!orig) throw new Error("Attempt not found");

  const { questions } = await getRawData();
  const byId = new Map(questions.map((q) => [q.id, q]));
  const re_questions = orig.details.map((d) => byId.get(d.questionId)).filter(Boolean);

  const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const sessionData = {
    id: testId,
    seriesId: orig.testId || orig.id,
    examTrack: orig.examTrack,
    chapters: orig.chapters,
    timed: Boolean(orig.timed),
    durationMinutes: orig.durationMinutes,
    createdAt: new Date().toISOString(),
    rawQuestions: shuffle(re_questions),
  };

  const sessions = readStorage<Record<string, any>>(SESSIONS_KEY, {});
  sessions[testId] = sessionData;
  writeStorage(SESSIONS_KEY, sessions);

  return {
    testId,
    examTrack: orig.examTrack,
    chapters: orig.chapters,
    timed: sessionData.timed,
    durationMinutes: sessionData.durationMinutes,
    requestedCount: re_questions.length,
    actualCount: re_questions.length,
    questions: sessionData.rawQuestions.map(sanitizeQuestion),
  };
}

export async function localGetProgress(filters: ProgressFilters): Promise<ProgressResponse> {
  const attempts = readStorage<AttemptResult[]>(ATTEMPTS_KEY, []);

  let filtered = attempts;
  if (filters.examTrack) filtered = filtered.filter((a) => a.examTrack === filters.examTrack);
  if (filters.timed !== undefined) {
    const isTimed = filters.timed === "true";
    filtered = filtered.filter((a) => Boolean(a.timed) === isTimed);
  }

  const totalTests = filtered.length;
  let totalScore = 0;
  let totalPossible = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalSkipped = 0;
  let totalQuestions = 0;

  for (const a of filtered) {
    totalScore += a.score;
    totalPossible += a.totalMarks;
    totalCorrect += a.correctCount;
    totalWrong += a.wrongCount;
    totalSkipped += a.skippedCount;
    totalQuestions += a.totalQuestions;
  }

  const overallAccuracyPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const overallScorePct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  return {
    timeSeries: [],
    subjectStats: [],
    chapterStats: [],
    totals: {
      totalAttempts: totalTests,
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalSkipped,
      overallScorePct,
      overallAccuracyPct,
    },
    availableFilters: {
      examTracks: ["prelims", "mains"],
      months: [],
      subjects: ["Reasoning & Computer Aptitude", "Quantitative Aptitude", "English Language", "General & Financial Awareness"],
      chaptersBySubject: {},
    },
  };
}
