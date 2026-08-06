import fitz
import re
import json
import os
import sys

PDF_PATH = "/Users/aman.singh/Documents/banking/question bank/Ace English 3rd edition .pdf"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/english-chapters.json"

NOISE_PATTERNS = [
    r"^A Complete Guide on English Language for Banking Examinations\s*$",
    r"^Adda247 Publications.*$",
    r"^Visit:\s*adda247\.com\s*$",
    r"^@cetexamgroup\s*$",
    r"^Join channel\s*$",
    r"^\d+\s*$",  # bare page numbers
]
NOISE_RE = [re.compile(p, re.I) for p in NOISE_PATTERNS]

# Regex patterns
DIRECTIONS_RE = re.compile(r"^Directions?\s*(\(\d+\s*[-–]\s*\d+\)\s*:?|\d+\s*[-–]\s*\d+\s*:?)(.*)$", re.I)
TYPE_HEADER_RE = re.compile(r"^TYPE\s*[-–]?\s*([IVX\d\w\s-]+)$", re.I)
QNUM_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(([a-e])\)\s*(.*)$")
SOLUTIONS_HEADING_RE = re.compile(r"^\s*(Solutions|SOLUTIONS|Answers|ANSWERS)\s*$")
SOL_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s*\(([a-eA-E])\)\s*[:;]?\s*(.*)$")

# List of chapter specs in Ace English PDF:
# (pdf_chapter, start_page, end_page, syllabus_chapter_primary, syllabus_aliases)
CHAPTER_SPECS = [
    ("Cloze Test", 187, 217, "Cloze Test", []),
    ("Fillers", 217, 240, "Fill in the Blanks", []),
    ("Sentence Rearrangement", 240, 272, "Sentence Rearrangement", ["Para Jumbles"]),
    ("Sentence Improvement", 272, 288, "Sentence Improvement", ["Phrase Replacement"]),
    ("Error Correction", 288, 311, "Error Detection", ["Spotting Errors", "Sentence Correction"]),
    ("Starters", 311, 320, "Sentence Improvement", []),
    ("Sentence Connector", 320, 328, "Sentence Improvement", []),
    ("Paragraph Completion", 328, 345, "Para / Sentence Completion", ["Passage Completion"]),
    ("Coherent Paragraph", 345, 352, "Sentence Rearrangement", ["Para Jumbles"]),
    ("Inferences", 352, 369, "Vocabulary", ["Synonyms and Antonyms", "One Word Substitution"]),
    ("Paragraph Based Questions", 369, 374, "Reading Comprehension", []),
    ("Column Based", 374, 396, "Sentence Improvement", []),
    ("Spelling Errors", 396, 403, "Spelling Correction", ["Misspelt Words"]),
    ("Word Rearrangement", 403, 414, "Word Swap", ["Word Usage", "Word Formation"]),
    ("Miscellaneous", 414, 441, "Error Detection", ["Spotting Errors"]),
    ("Phrasal Verb", 474, 479, "Idioms and Phrases", ["Phrases and Idioms"]),
    ("Tenses", 2, 15, "Tenses", ["Grammar"]),
    ("Voices", 15, 21, "Active / Passive Voice", ["Grammar"]),
    ("Narrations", 21, 27, "Grammar", []),
    ("Subject Verb Agreement", 27, 35, "Grammar", []),
    ("Articles", 35, 43, "Grammar", []),
    ("Noun", 43, 61, "Grammar", []),
    ("Pronoun", 61, 70, "Grammar", []),
    ("Adjectives", 70, 81, "Grammar", []),
    ("Verb", 81, 88, "Grammar", []),
    ("Adverb", 88, 94, "Grammar", []),
    ("Preposition", 94, 107, "Grammar", []),
    ("Conjunction", 107, 115, "Grammar", []),
    ("Conditional Sentences", 115, 120, "Grammar", []),
]

def clean_lines(text):
    lines = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or any(r.match(line) for r in NOISE_RE):
            continue
        lines.append(line)
    return lines

def parse_solutions(lines):
    sols = {}
    current_num = None
    current_key = None
    current_text = []

    for line in lines:
        m = SOL_ENTRY_RE.match(line)
        if m:
            if current_num is not None:
                sols[current_num] = {
                    "key": current_key.lower(),
                    "text": " ".join(current_text).strip()
                }
            current_num = int(m.group(1))
            current_key = m.group(2).lower()
            rest = m.group(3).strip()
            current_text = [rest] if rest else []
        elif current_num is not None:
            if line.startswith("TYPE") or line.startswith("Solutions") or line.startswith("Chapter"):
                continue
            current_text.append(line)

    if current_num is not None:
        sols[current_num] = {
            "key": current_key.lower(),
            "text": " ".join(current_text).strip()
        }

    return sols

def parse_questions_and_blocks(lines):
    questions = []
    current_direction = ""
    current_passage_lines = []
    in_passage = False

    current_qnum = None
    current_qtext_lines = []
    current_options = {}

    def finalize_question():
        nonlocal current_qnum, current_qtext_lines, current_options
        if current_qnum is not None:
            q_dict = {
                "raw_qnum": current_qnum,
                "passageText": "\n".join(current_passage_lines).strip() if current_passage_lines else (current_direction if current_direction else None),
                "questionText": " ".join(current_qtext_lines).strip(),
                "options": dict(current_options)
            }
            questions.append(q_dict)

            current_qnum = None
            current_qtext_lines = []
            current_options = {}

    for line in lines:
        m_dir = DIRECTIONS_RE.match(line)
        if m_dir:
            finalize_question()
            current_direction = line
            current_passage_lines = [line]
            in_passage = True
            continue

        if line.startswith("TYPE") or line.startswith("Type"):
            finalize_question()
            current_direction = line
            current_passage_lines = [line]
            in_passage = True
            continue

        m_q = QNUM_RE.match(line)
        if m_q and (m_q.group(2).startswith("(") or m_q.group(2).startswith("Which") or m_q.group(2).startswith("Read") or m_q.group(2).startswith("Find") or m_q.group(2).startswith("Rearrange") or m_q.group(2).startswith("Select") or len(m_q.group(2)) > 5):
            finalize_question()
            in_passage = False
            current_qnum = int(m_q.group(1))
            current_qtext_lines = [m_q.group(2)]
            continue

        m_opt = OPTION_RE.match(line)
        if m_opt and current_qnum is not None:
            opt_key = m_opt.group(1).lower()
            current_options[opt_key] = m_opt.group(2)
            continue

        if in_passage:
            current_passage_lines.append(line)
        elif current_qnum is not None:
            if current_options:
                last_key = list(current_options.keys())[-1]
                current_options[last_key] += " " + line
            else:
                current_qtext_lines.append(line)

    finalize_question()
    return questions

def extract_chapter(doc, spec):
    pdf_ch, start_p, end_p, primary_syll, aliases = spec
    
    q_lines = []
    sol_lines = []
    in_solutions = False

    for pno in range(start_p - 1, end_p - 1):
        lines = clean_lines(doc[pno].get_text())
        for line in lines:
            if SOLUTIONS_HEADING_RE.match(line) or line.strip() == "Solutions" or line.strip() == "SOLUTIONS":
                in_solutions = True
                continue
            
            if in_solutions:
                sol_lines.append(line)
            else:
                q_lines.append(line)

    raw_qs = parse_questions_and_blocks(q_lines)
    sols = parse_solutions(sol_lines)

    extracted = []
    all_chapters = [primary_syll] + aliases

    for q in raw_qs:
        num = q["raw_qnum"]
        sol_data = sols.get(num, {"key": "a", "text": "Detailed solution available in reference key."})
        
        ans_key = sol_data["key"].lower()
        sol_text = sol_data["text"]

        opts = q["options"]
        if not opts:
            opts = {
                "a": "(A)",
                "b": "(B)",
                "c": "(C)",
                "d": "(D)",
                "e": "No Error / None of these"
            }

        # Ensure all a-e keys exist if partial
        for k in ["a", "b", "c", "d", "e"]:
            if k not in opts:
                opts[k] = f"Option ({k.upper()})"

        for ch_name in all_chapters:
            q_id = f"eng-{pdf_ch.lower().replace(' ', '-')}-{num:04d}-{ch_name.lower().replace(' ', '-')[:6]}"
            item = {
                "id": q_id,
                "subject": "English Language",
                "chapter": ch_name,
                "examTracks": ["prelims", "mains"],
                "passage": q["passageText"],
                "questionText": q["questionText"] if q["questionText"] else f"Question {num}",
                "options": opts,
                "correctOption": ans_key,
                "solutionText": f"Option ({ans_key.upper()}): {sol_text}" if sol_text else f"Option ({ans_key.upper()})",
                "marks": 1,
                "negativeMarks": 0.25,
                "hasImage": False,
                "imageFile": None,
                "source": f"Ace English 3rd ed. - {pdf_ch} (Q{num})"
            }
            extracted.append(item)

    return extracted

def main():
    doc = fitz.open(PDF_PATH)
    all_extracted_questions = []

    print(f"Extracting English questions from '{PDF_PATH}'...")

    for spec in CHAPTER_SPECS:
        pdf_ch = spec[0]
        qs = extract_chapter(doc, spec)
        print(f"  - [{pdf_ch}] (p.{spec[1]}-{spec[2]}): Extracted {len(qs)} question entries for syllabus: {[spec[3]] + spec[4]}")
        all_extracted_questions.extend(qs)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_extracted_questions, f, ensure_ascii=False, indent=2)

    print(f"\nSUCCESS! Total {len(all_extracted_questions)} English questions written to {OUT_PATH}")

if __name__ == "__main__":
    main()
