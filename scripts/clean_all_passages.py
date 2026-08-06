import json
import glob
import os
import re

QUESTIONS_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions"

CLEAN_PREFIX_RE = re.compile(
    r"^\s*(?:Directions?\s*\(\d+[-–]\d+\)\s*:?\s*)?"
    r"(?:(?:Read|Study|Answer)?\s*(?:the\s+following\s+information|the\s+following\s+passage|the\s+passage|the\s+questions?)?\s*"
    r"(?:carefully\s+and\s+answer|and\s+answer|carefully)?\s*"
    r"(?:the\s+questions?\s+given\s+below\s*(?:them|it)?[\.:,]?\s*))+"
    r"(?:Read\s+the\s+following\s+information\s*carefully\s+and\s+answer\s+the\s+questions?\s+given\s+below[\.:,]?\s*)?",
    re.I
)

def clean_passage_text(text):
    if not text:
        return text
    cleaned = text.strip()
    cleaned = CLEAN_PREFIX_RE.sub("", cleaned).strip()
    cleaned = re.sub(r"^(?:the\s+questions?\s+given\s+below\s*(?:them|it)?[\.:,]?\s*)+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"^(?:Read|Study)\s+the\s+following\s+(?:information|passage)\s+carefully\s+and\s+answer\s+the\s+questions?\s*(?:that\s+follow|given\s+below)?[\.:,]?\s*", "", cleaned, flags=re.I).strip()
    return cleaned

def main():
    files = glob.glob(os.path.join(QUESTIONS_DIR, "*.json"))
    total_cleaned = 0

    for fpath in sorted(files):
        data = json.load(open(fpath))
        file_cleaned = 0

        for q in data:
            if q.get("passage"):
                orig = q["passage"]
                cleaned = clean_passage_text(orig)
                if cleaned != orig:
                    q["passage"] = cleaned
                    file_cleaned += 1

            if q.get("solutionText"):
                orig_sol = q["solutionText"]
                cleaned_sol = clean_passage_text(orig_sol)
                if cleaned_sol != orig_sol:
                    q["solutionText"] = cleaned_sol
                    file_cleaned += 1

        if file_cleaned > 0:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Cleaned {file_cleaned} passage/solution prefixes in {os.path.basename(fpath)}")
            total_cleaned += file_cleaned

    print(f"Finished. Total cleaned across all files: {total_cleaned}")

if __name__ == "__main__":
    main()
