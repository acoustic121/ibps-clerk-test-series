/**
 * Prelims and Mains use DIFFERENT subject labels for the same underlying content
 * (e.g. Prelims "Numerical Ability" vs Mains "Quantitative Aptitude"). A question is
 * extracted once and tagged with ONE subject string, but must still be counted/matched
 * correctly under both tracks' syllabus cards. This maps every known label to a
 * track-independent family key so matching happens on family, not on exact string equality.
 *
 * Canonical tagging convention for new extractions: use the MAINS label as `subject`
 * ("Reasoning & Computer Aptitude", "Quantitative Aptitude", "English Language",
 * "General & Financial Awareness") - it's already in this map either way, so a question
 * naturally shows up under both Prelims and Mains chapter lists when the chapter exists
 * in both syllabuses.
 */
export const SUBJECT_FAMILY = {
  "Reasoning Ability": "reasoning",
  "Reasoning & Computer Aptitude": "reasoning",
  "Numerical Ability": "quant",
  "Quantitative Aptitude": "quant",
  "English Language": "english",
  "General & Financial Awareness": "general_awareness",
};

export function familyOf(subjectName) {
  return SUBJECT_FAMILY[subjectName] ?? subjectName;
}

export function familyKey(subjectName, chapterName) {
  return `${familyOf(subjectName)}::${chapterName}`;
}
