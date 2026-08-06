/**
 * A "series" groups every attempt that used the exact same question set (the original build
 * plus every re-attempt of it), so progress across repeats of one test can be tracked together.
 */
export function buildSeriesList(attempts) {
  const groups = {};
  for (const a of attempts) {
    const seriesId = a.seriesId || a.id; // defensive fallback for any pre-existing attempt without one
    (groups[seriesId] ||= []).push(a);
  }

  const series = Object.entries(groups).map(([seriesId, group]) => {
    const sorted = [...group].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const scores = sorted.map((a) => a.score);
    const latest = sorted[sorted.length - 1];
    return {
      seriesId,
      examTrack: latest.examTrack,
      chapters: latest.chapters,
      totalMarks: latest.totalMarks,
      totalQuestions: latest.totalQuestions,
      timed: latest.timed,
      attemptsCount: sorted.length,
      bestScore: Math.max(...scores),
      latestScore: latest.score,
      firstAttemptAt: sorted[0].submittedAt,
      lastAttemptAt: latest.submittedAt,
      attempts: sorted.map((a) => ({
        id: a.id,
        submittedAt: a.submittedAt,
        score: a.score,
        correctCount: a.correctCount,
        wrongCount: a.wrongCount,
        skippedCount: a.skippedCount,
        timeTakenSeconds: a.timeTakenSeconds,
      })),
    };
  });

  series.sort((a, b) => new Date(b.lastAttemptAt) - new Date(a.lastAttemptAt));
  return series;
}
