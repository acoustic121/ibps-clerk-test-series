export interface ChapterInfo {
  name: string;
  availableQuestions: number;
  freshQuestions: number;
}

export interface SubjectInfo {
  name: string;
  chapters: ChapterInfo[];
}

export interface ExamTrackInfo {
  label: string;
  totalMarks: number;
  durationMinutes: number;
  subjects: SubjectInfo[];
}

export type ExamTrackKey = "prelims" | "mains" | "real_prelims" | "real_mains";

export type Syllabus = Record<ExamTrackKey, ExamTrackInfo>;

export interface ChapterSelector {
  subject: string;
  chapter: string;
}

export interface TestQuestion {
  id: string;
  subject: string;
  chapter: string;
  passage: string | null;
  questionText: string;
  options: Record<string, string>;
  hasImage: boolean;
  imagePath: string | null;
  marks: number;
  negativeMarks: number;
}

export interface TestSession {
  testId: string;
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  timed: boolean;
  durationMinutes: number | null;
  requestedCount: number;
  actualCount: number;
  poolNotices?: string[];
  questions: TestQuestion[];
}

export type AnswerStatus = "correct" | "wrong" | "skipped";

export interface AttemptDetail {
  questionId: string;
  subject: string;
  chapter: string;
  passage: string | null;
  questionText: string;
  options: Record<string, string>;
  hasImage: boolean;
  correctOption: string;
  userAnswer: string | null;
  status: AnswerStatus;
  marksAwarded: number;
  solutionText: string;
}

export interface SectionScore {
  subject: string;
  score: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  skipped: number;
}

export interface AttemptResult {
  id: string;
  testId: string;
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  timed: boolean;
  durationMinutes: number | null;
  timeTakenSeconds: number | null;
  submittedAt: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  sectionWise: SectionScore[];
  details: AttemptDetail[];
}

export interface ProgressTimePoint {
  attemptId: string;
  date: string;
  examTrack: ExamTrackKey;
  totalQuestions: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  maxMarks: number;
  scorePct: number;
  accuracyPct: number;
}

export interface ProgressAggStat {
  subject: string;
  chapter?: string;
  correct: number;
  wrong: number;
  skipped: number;
  marksAwarded: number;
  maxMarks: number;
  totalQuestions: number;
  scorePct: number;
  accuracyPct: number;
}

export interface ProgressTotals {
  totalAttempts: number;
  totalQuestions: number;
  totalCorrect: number;
  totalWrong: number;
  totalSkipped: number;
  overallScorePct: number;
  overallAccuracyPct: number;
}

export interface AvailableFilters {
  examTracks: string[];
  months: string[];
  subjects: string[];
  chaptersBySubject: Record<string, string[]>;
}

export interface ProgressResponse {
  timeSeries: ProgressTimePoint[];
  subjectStats: ProgressAggStat[];
  chapterStats: ProgressAggStat[];
  totals: ProgressTotals;
  availableFilters: AvailableFilters;
}

export interface ProgressFilters {
  examTrack?: string;
  timed?: string;
  month?: string;
  subject?: string;
  chapter?: string;
}

export interface SeriesAttemptSummary {
  id: string;
  submittedAt: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number | null;
}

export interface SeriesInfo {
  seriesId: string;
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  totalMarks: number;
  totalQuestions: number;
  timed: boolean;
  attemptsCount: number;
  bestScore: number;
  latestScore: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  attempts: SeriesAttemptSummary[];
}

export interface AttemptSummary {
  id: string;
  examTrack: ExamTrackKey;
  chapters: ChapterSelector[];
  submittedAt: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  timed: boolean;
  timeTakenSeconds: number | null;
}
