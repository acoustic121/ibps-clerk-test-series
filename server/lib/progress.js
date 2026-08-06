function round1(n) {
  return Math.round(n * 10) / 10;
}

function monthKey(isoDate) {
  return isoDate.slice(0, 7); // YYYY-MM
}

/**
 * filters: { examTrack, timed, month, subject, chapter }
 * All optional; "all"/undefined means no restriction on that dimension.
 */
export function buildProgress(attempts, filters = {}) {
  const { examTrack, timed, month, subject, chapter } = filters;

  const attemptFiltered = attempts.filter((a) => {
    if (examTrack && examTrack !== "all" && a.examTrack !== examTrack) return false;
    if (timed === "timed" && !a.timed) return false;
    if (timed === "untimed" && a.timed) return false;
    if (month && month !== "all" && monthKey(a.submittedAt) !== month) return false;
    return true;
  });

  // Time series: for each attempt, narrow its question details down to the subject/chapter
  // filter (if any) and recompute score%/accuracy% from just that subset, so drilling into a
  // single chapter still plots one point per attempt that actually touched it.
  const timeSeries = [];
  for (const a of attemptFiltered) {
    const relevant = a.details.filter(
      (d) => (!subject || subject === "all" || d.subject === subject) && (!chapter || chapter === "all" || d.chapter === chapter)
    );
    if (relevant.length === 0) continue;

    const correct = relevant.filter((d) => d.status === "correct").length;
    const wrong = relevant.filter((d) => d.status === "wrong").length;
    const skipped = relevant.filter((d) => d.status === "skipped").length;
    const marksAwarded = relevant.reduce((sum, d) => sum + d.marksAwarded, 0);
    const maxMarks = relevant.reduce((sum, d) => sum + d.marks, 0);
    const attempted = correct + wrong;

    timeSeries.push({
      attemptId: a.id,
      date: a.submittedAt,
      examTrack: a.examTrack,
      totalQuestions: relevant.length,
      correct,
      wrong,
      skipped,
      score: round1(marksAwarded),
      maxMarks,
      scorePct: maxMarks > 0 ? round1((marksAwarded / maxMarks) * 100) : 0,
      accuracyPct: attempted > 0 ? round1((correct / attempted) * 100) : 0,
    });
  }
  timeSeries.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Subject-wise and chapter-wise stats always aggregate over ALL details in the
  // exam-track/timed/month-filtered attempts (not narrowed by subject/chapter), so the
  // comparison charts stay meaningful while the subject filter still narrows which chapters show.
  const subjectAgg = {};
  const chapterAgg = {};
  for (const a of attemptFiltered) {
    for (const d of a.details) {
      subjectAgg[d.subject] = subjectAgg[d.subject] || { subject: d.subject, correct: 0, wrong: 0, skipped: 0, marksAwarded: 0, maxMarks: 0 };
      const s = subjectAgg[d.subject];
      s.marksAwarded += d.marksAwarded;
      s.maxMarks += d.marks;
      if (d.status === "correct") s.correct += 1;
      else if (d.status === "wrong") s.wrong += 1;
      else s.skipped += 1;

      if (subject && subject !== "all" && d.subject !== subject) continue;
      const key = `${d.subject}::${d.chapter}`;
      chapterAgg[key] = chapterAgg[key] || { subject: d.subject, chapter: d.chapter, correct: 0, wrong: 0, skipped: 0, marksAwarded: 0, maxMarks: 0 };
      const c = chapterAgg[key];
      c.marksAwarded += d.marksAwarded;
      c.maxMarks += d.marks;
      if (d.status === "correct") c.correct += 1;
      else if (d.status === "wrong") c.wrong += 1;
      else c.skipped += 1;
    }
  }

  function finalize(agg) {
    const attempted = agg.correct + agg.wrong;
    return {
      ...agg,
      totalQuestions: agg.correct + agg.wrong + agg.skipped,
      scorePct: agg.maxMarks > 0 ? round1((agg.marksAwarded / agg.maxMarks) * 100) : 0,
      accuracyPct: attempted > 0 ? round1((agg.correct / attempted) * 100) : 0,
    };
  }

  const subjectStats = Object.values(subjectAgg).map(finalize);
  const chapterStats = Object.values(chapterAgg).map(finalize).sort((a, b) => a.accuracyPct - b.accuracyPct);

  const totalCorrect = timeSeries.reduce((s, t) => s + t.correct, 0);
  const totalWrong = timeSeries.reduce((s, t) => s + t.wrong, 0);
  const totalSkipped = timeSeries.reduce((s, t) => s + t.skipped, 0);
  const totalMarksAwarded = timeSeries.reduce((s, t) => s + t.score, 0);
  const totalMaxMarks = timeSeries.reduce((s, t) => s + t.maxMarks, 0);
  const attemptedTotal = totalCorrect + totalWrong;

  const totals = {
    totalAttempts: timeSeries.length,
    totalQuestions: totalCorrect + totalWrong + totalSkipped,
    totalCorrect,
    totalWrong,
    totalSkipped,
    overallScorePct: totalMaxMarks > 0 ? round1((totalMarksAwarded / totalMaxMarks) * 100) : 0,
    overallAccuracyPct: attemptedTotal > 0 ? round1((totalCorrect / attemptedTotal) * 100) : 0,
  };

  return { timeSeries, subjectStats, chapterStats, totals };
}

export function buildAvailableFilters(attempts) {
  const examTracks = new Set();
  const months = new Set();
  const chaptersBySubject = {};

  for (const a of attempts) {
    examTracks.add(a.examTrack);
    months.add(monthKey(a.submittedAt));
    for (const d of a.details) {
      chaptersBySubject[d.subject] = chaptersBySubject[d.subject] || new Set();
      chaptersBySubject[d.subject].add(d.chapter);
    }
  }

  return {
    examTracks: Array.from(examTracks).sort(),
    months: Array.from(months).sort().reverse(),
    subjects: Object.keys(chaptersBySubject).sort(),
    chaptersBySubject: Object.fromEntries(
      Object.entries(chaptersBySubject).map(([subject, set]) => [subject, Array.from(set).sort()])
    ),
  };
}
