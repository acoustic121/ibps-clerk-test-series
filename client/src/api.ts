import type {
  AttemptResult,
  AttemptSummary,
  ChapterSelector,
  ExamTrackKey,
  ProgressFilters,
  ProgressResponse,
  SeriesInfo,
  Syllabus,
  TestSession,
} from "./types";
import {
  localGetSyllabus,
  localBuildTest,
  localGetTest,
  localSubmitTest,
  localListAttempts,
  localGetAttempt,
  localGetSeries,
  localReattempt,
  localGetProgress,
} from "./localBackend";

const IS_STATIC_BUILD =
  import.meta.env.PROD ||
  window.location.hostname.includes("github.io") ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getSyllabus(): Promise<Syllabus> {
  if (IS_STATIC_BUILD) return localGetSyllabus();
  return req<Syllabus>("/api/syllabus").catch(() => localGetSyllabus());
}

export async function buildTest(params: {
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  numQuestions: number;
  timed: boolean;
  durationMinutes?: number;
}): Promise<TestSession> {
  if (IS_STATIC_BUILD) return localBuildTest(params);
  return req<TestSession>("/api/tests", {
    method: "POST",
    body: JSON.stringify(params),
  }).catch(() => localBuildTest(params));
}

export async function getTest(testId: string): Promise<TestSession> {
  if (IS_STATIC_BUILD || testId.startsWith("test-")) return localGetTest(testId);
  return req<TestSession>(`/api/tests/${testId}`).catch(() => localGetTest(testId));
}

export async function submitTest(
  testId: string,
  answers: Record<string, string | null>,
  timeTakenSeconds: number | null
): Promise<AttemptResult> {
  if (IS_STATIC_BUILD || testId.startsWith("test-"))
    return localSubmitTest(testId, answers, timeTakenSeconds);
  return req<AttemptResult>(`/api/tests/${testId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers, timeTakenSeconds }),
  }).catch(() => localSubmitTest(testId, answers, timeTakenSeconds));
}

export async function listAttempts(): Promise<AttemptSummary[]> {
  if (IS_STATIC_BUILD) return localListAttempts();
  return req<AttemptSummary[]>("/api/attempts").catch(() => localListAttempts());
}

export async function getAttempt(id: string): Promise<AttemptResult> {
  if (IS_STATIC_BUILD || id.startsWith("att-")) return localGetAttempt(id);
  return req<AttemptResult>(`/api/attempts/${id}`).catch(() => localGetAttempt(id));
}

export async function getSeries(): Promise<SeriesInfo[]> {
  if (IS_STATIC_BUILD) return localGetSeries();
  return req<SeriesInfo[]>("/api/series").catch(() => localGetSeries());
}

export async function reattempt(attemptId: string): Promise<TestSession> {
  if (IS_STATIC_BUILD || attemptId.startsWith("att-")) return localReattempt(attemptId);
  return req<TestSession>(`/api/attempts/${attemptId}/reattempt`, { method: "POST" }).catch(
    () => localReattempt(attemptId)
  );
}

export async function getProgress(filters: ProgressFilters): Promise<ProgressResponse> {
  if (IS_STATIC_BUILD) return localGetProgress(filters);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return req<ProgressResponse>(`/api/progress${qs ? `?${qs}` : ""}`).catch(() =>
    localGetProgress(filters)
  );
}
