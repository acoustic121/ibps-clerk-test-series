export function scoreTest(questions, answers) {
  let score = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const bySubject = {};

  const details = questions.map((q) => {
    totalMarks += q.marks;
    const userAnswer = answers[q.id] ?? null;
    let marksAwarded = 0;
    let status = "skipped";

    if (userAnswer) {
      if (userAnswer === q.correctOption) {
        marksAwarded = q.marks;
        correctCount += 1;
        status = "correct";
      } else {
        marksAwarded = -q.negativeMarks;
        wrongCount += 1;
        status = "wrong";
      }
    } else {
      skippedCount += 1;
    }
    score += marksAwarded;

    bySubject[q.subject] = bySubject[q.subject] || { subject: q.subject, score: 0, totalMarks: 0, correct: 0, wrong: 0, skipped: 0 };
    bySubject[q.subject].totalMarks += q.marks;
    bySubject[q.subject].score += marksAwarded;
    if (status === "correct") bySubject[q.subject].correct += 1;
    else if (status === "wrong") bySubject[q.subject].wrong += 1;
    else bySubject[q.subject].skipped += 1;

    return {
      questionId: q.id,
      subject: q.subject,
      chapter: q.chapter,
      passage: q.passage,
      questionText: q.questionText,
      options: q.options,
      hasImage: q.hasImage,
      correctOption: q.correctOption,
      userAnswer,
      status,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      marksAwarded,
      solutionText: q.solutionText,
    };
  });

  return {
    score: round2(score),
    totalMarks,
    correctCount,
    wrongCount,
    skippedCount,
    totalQuestions: questions.length,
    sectionWise: Object.values(bySubject).map((s) => ({ ...s, score: round2(s.score) })),
    details,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
