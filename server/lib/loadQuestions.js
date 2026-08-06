import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { familyOf } from "./subjectFamilies.js";
import { getUsedByKey, freshCountForChapter } from "./usage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = path.join(__dirname, "..", "data", "questions");
const SYLLABUS_PATH = path.join(__dirname, "..", "data", "syllabus.json");

export function loadAllQuestions() {
  const files = fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith(".json"));
  const all = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf-8"));
    all.push(...content);
  }
  return all;
}

export function loadSyllabus() {
  return JSON.parse(fs.readFileSync(SYLLABUS_PATH, "utf-8"));
}

/**
 * Returns syllabus with, per chapter: `availableQuestions` (total pool) and
 * `freshQuestions` (not yet seen in a submitted attempt this cycle - resets to the full
 * count once every question in the chapter has been used at least once).
 */
export function buildSyllabusWithCounts(questions) {
  const syllabus = loadSyllabus();
  const usedByKey = getUsedByKey();
  for (const [track, trackData] of Object.entries(syllabus)) {
    for (const subject of trackData.subjects) {
      subject.chapters = subject.chapters.map((chapterName) => {
        const chapterPool = questions.filter(
          (q) =>
            q.examTracks.includes(track) &&
            familyOf(q.subject) === familyOf(subject.name) &&
            q.chapter === chapterName
        );
        return {
          name: chapterName,
          availableQuestions: chapterPool.length,
          freshQuestions: freshCountForChapter(subject.name, chapterName, chapterPool, usedByKey),
        };
      });
    }
  }
  return syllabus;
}
