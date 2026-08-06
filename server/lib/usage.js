import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { familyKey } from "./subjectFamilies.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_PATH = path.join(__dirname, "..", "data", "usage_state.json");

/**
 * Tracks, per chapter (family::chapter key), which question ids have been used in the
 * CURRENTLY OPEN cycle. This is persisted and updated ONCE per submitted attempt - each
 * cycle-completion decision is made and frozen using the chapter's pool size at that exact
 * moment, and is never revisited later. That matters: if it were instead recomputed from
 * scratch on every request by replaying history against TODAY's pool size, appending new
 * questions to a chapter would retroactively erase previously-completed cycles (a past
 * cycle that used all 203 of the original questions would stop counting as "complete" the
 * moment the pool grew to 208, since 203 < 208) - collapsing already-finished cycles into
 * one open-ended mega-cycle. Freezing the decision at submit time avoids that entirely: new
 * questions just enlarge whatever cycle is CURRENTLY open, exactly as intended.
 */
function readUsageState() {
  if (!fs.existsSync(USAGE_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(USAGE_PATH, "utf-8"));
  const state = {};
  for (const [key, ids] of Object.entries(raw)) state[key] = new Set(ids);
  return state;
}

function writeUsageState(state) {
  const raw = {};
  for (const [key, idSet] of Object.entries(state)) raw[key] = Array.from(idSet);
  fs.writeFileSync(USAGE_PATH, JSON.stringify(raw, null, 2));
}

export function getUsedByKey() {
  return readUsageState();
}

/**
 * Call once per submitted attempt. `details` is the attempt's scored question list (each with
 * subject/chapter/questionId) - the same shape scoring.js already produces.
 */
export function recordAttemptUsage(details, allQuestions) {
  const poolIdsByKey = {};
  for (const q of allQuestions) {
    const key = familyKey(q.subject, q.chapter);
    (poolIdsByKey[key] ||= new Set()).add(q.id);
  }

  const state = readUsageState();
  const touchedKeys = new Set();
  for (const d of details) {
    const key = familyKey(d.subject, d.chapter);
    (state[key] ||= new Set()).add(d.questionId);
    touchedKeys.add(key);
  }
  for (const key of touchedKeys) {
    const poolIds = poolIdsByKey[key];
    if (poolIds && poolIds.size > 0 && state[key].size >= poolIds.size) {
      state[key] = new Set(); // cycle complete as of right now - frozen, won't be re-derived later
    }
  }
  writeUsageState(state);
}

/**
 * For each selected chapter, narrow its pool down to this-cycle-unused questions. Also returns
 * a per-chapter breakdown so the caller can tell, after sampling, whether a chapter's remaining
 * fresh questions are about to be fully consumed by this test.
 */
export function selectEligiblePool(chapters, examTrack, allQuestions, usedByKey) {
  const combinedPool = [];
  const perChapter = [];

  for (const c of chapters) {
    const key = familyKey(c.subject, c.chapter);
    const chapterPool = allQuestions.filter(
      (q) => q.examTracks.includes(examTrack) && familyKey(q.subject, q.chapter) === key
    );
    if (chapterPool.length === 0) continue;

    const used = usedByKey[key] || new Set();
    const unused = chapterPool.filter((q) => !used.has(q.id));

    combinedPool.push(...unused);
    perChapter.push({ key, chapterLabel: c.chapter, unusedIds: unused.map((q) => q.id) });
  }

  return { pool: combinedPool, perChapter };
}

/** Fresh (this-cycle-unused) question count for one chapter, for display in the picker. */
export function freshCountForChapter(subjectName, chapterName, chapterPool, usedByKey) {
  if (chapterPool.length === 0) return 0;
  const used = usedByKey[familyKey(subjectName, chapterName)] || new Set();
  return chapterPool.filter((q) => !used.has(q.id)).length;
}
