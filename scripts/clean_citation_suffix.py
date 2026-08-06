"""One-off cleanup: strip trailing exam-citation tags (e.g. 'None of these IBPS CLERK PRE 2019')
that got glued onto the last option's text during extraction. Operates directly on the already
extracted JSON so it doesn't need PDF file access.
"""
import json
import re

PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/reading-comprehension.json"

CITATION_SUFFIX_RE = re.compile(
    r"(\s*(IBPS|SBI|RBI|RRB|SSC)\s+(PO|CLERK|SO|SPECIALIST OFFICER)\s+"
    r"(PRE|PRELIMS|MAINS)\s+\d{4}\s*)+$",
    re.I,
)


def strip_citation_suffix(text):
    if not text:
        return text
    return CITATION_SUFFIX_RE.sub("", text).strip()


def main():
    data = json.load(open(PATH))
    changed = 0
    for q in data:
        new_qtext = strip_citation_suffix(q["questionText"])
        new_passage = strip_citation_suffix(q["passage"]) if q["passage"] else q["passage"]
        new_options = {k: strip_citation_suffix(v) for k, v in q["options"].items()}
        if new_qtext != q["questionText"] or new_passage != q["passage"] or new_options != q["options"]:
            changed += 1
        q["questionText"] = new_qtext
        q["passage"] = new_passage
        q["options"] = new_options
    with open(PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Cleaned {changed} of {len(data)} questions")


if __name__ == "__main__":
    main()
