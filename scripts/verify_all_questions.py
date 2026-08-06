import json
import glob
import os

QUESTIONS_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions"
SYLLABUS_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/syllabus.json"

VALID_SUBJECTS = {
    "Reasoning & Computer Aptitude",
    "Quantitative Aptitude",
    "English Language",
    "General & Financial Awareness"
}

def main():
    syllabus = json.load(open(SYLLABUS_PATH))
    known_chapters = set()
    for track in ["prelims", "mains"]:
        for subj in syllabus[track]["subjects"]:
            for ch in subj["chapters"]:
                known_chapters.add(ch)

    files = glob.glob(os.path.join(QUESTIONS_DIR, "*.json"))
    print(f"Found {len(files)} question JSON files:")

    total_q = 0
    by_subject = {}
    by_chapter = {}
    invalid_items = []

    for fpath in sorted(files):
        fname = os.path.basename(fpath)
        data = json.load(open(fpath))
        print(f"  - {fname}: {len(data)} questions")
        total_q += len(data)

        for q in data:
            # Check required keys
            required_keys = ["id", "subject", "chapter", "examTracks", "questionText", "options", "correctOption", "solutionText", "marks", "negativeMarks", "hasImage"]
            missing = [k for k in required_keys if k not in q]
            if missing:
                invalid_items.append((q.get("id"), f"Missing keys: {missing}"))
                continue

            subj = q["subject"]
            ch = q["chapter"]

            if subj not in VALID_SUBJECTS:
                invalid_items.append((q["id"], f"Invalid subject: '{subj}'"))

            if ch not in known_chapters:
                invalid_items.append((q["id"], f"Unknown chapter: '{ch}'"))

            opts = q["options"]
            if not isinstance(opts, dict) or len(opts) < 2:
                invalid_items.append((q["id"], "Options invalid or fewer than 2"))

            c_opt = q["correctOption"]
            if c_opt not in opts:
                invalid_items.append((q["id"], f"correctOption '{c_opt}' not in options"))

            by_subject[subj] = by_subject.get(subj, 0) + 1
            by_chapter[ch] = by_chapter.get(ch, 0) + 1

    print("\n==================== VERIFICATION SUMMARY ====================")
    print(f"Total Questions Verified: {total_q}")
    print(f"Invalid / Malformed Items: {len(invalid_items)}")

    if invalid_items:
        print("Invalid item sample:", invalid_items[:10])

    print("\nQuestions by Canonical Subject:")
    for s, cnt in sorted(by_subject.items()):
        print(f"  {s:32s}: {cnt:4d}")

    print("\nExtracted Chapters ({0} chapters covered):".format(len(by_chapter)))
    for c, cnt in sorted(by_chapter.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {c:45s}: {cnt:3d} questions")

if __name__ == "__main__":
    main()
