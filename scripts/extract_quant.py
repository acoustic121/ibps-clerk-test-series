import fitz
import re
import json
import os

PDF_PATH = "/Users/aman.singh/Documents/banking/question bank/ace quant Latest edition.pdf"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/quant-chapters.json"
IMAGES_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/images/quant"

os.makedirs(IMAGES_DIR, exist_ok=True)

CHAPTER_MAP = [
    (2, 33, "Simplification / Approximation", "Ch 1 - Simplification"),
    (33, 61, "Ratio and Proportion", "Ch 2 - Ratio & Proportion"),
    (61, 83, "Ratio and Proportion", "Ch 3 - Percentage"),
    (83, 116, "Profit and Loss", "Ch 4 - Profit and Loss"),
    (116, 142, "Simple and Compound Interest", "Ch 5 - SI & CI"),
    (142, 167, "Average", "Ch 6 - Average"),
    (167, 208, "Work, Time, and Energy", "Ch 7 - Time & Work"),
    (208, 243, "Time and Distance", "Ch 8 - Speed, Time & Distance"),
    (243, 265, "Time and Distance", "Ch 9 - Boat & Stream"),
    (265, 286, "Ratio and Proportion", "Ch 10 - Mixture & Alligation"),
    (286, 319, "Mensuration", "Ch 11 - Mensuration"),
    (319, 342, "Permutation and Combination", "Ch 12 - P&C and Probability"),
    (342, 368, "Number Series", "Ch 13 - Number Series"),
    (368, 409, "Quadratic Equation", "Ch 14 - Inequality"),
    (409, 464, "Data Interpretation", "Ch 15 - DI"),
    (464, 497, "Data Sufficiency", "Ch 16 - Data Sufficiency")
]

NOISE_PATTERNS = [
    r"^A Complete Guide on Quantitative Aptitude for Banking & Insurance Examinations\s*$",
    r"^Adda247 Publications.*$",
    r"^Visit:\s*adda247\.com\s*$",
    r"^\d+\s*$",
]
NOISE_RE = [re.compile(p, re.I) for p in NOISE_PATTERNS]

DIRECTIONS_RE = re.compile(r"^Directions?\s*\((\d+)\s*[-–]\s*(\d+)\)\s*:?(.*)$", re.I)
QNUM_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(([a-e])\)\s*(.*)$")
SOL_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s*\(([a-e])\)\s*[:;]?\s*(.*)$")
SOL_NUM_RE = re.compile(r"^(\d{1,3})\.\s*$")
SOL_OPT_RE = re.compile(r"^\(([a-e])\)\s*[:;]?\s*(.*)$")
SOLUTIONS_HEADER = re.compile(r"^Solutions?\s*$", re.I)

CITATION_SUFFIX_RE = re.compile(
    r"(\s*(IBPS|SBI|RBI|RRB|SSC)\s+(PO|CLERK|SO|SPECIALIST OFFICER)\s+"
    r"(PRE|PRELIMS|MAINS)\s+\d{4}\s*)+$",
    re.I,
)

def strip_citation_suffix(text):
    if not text:
        return text
    return CITATION_SUFFIX_RE.sub("", text).strip()

def clean_lines(page_text):
    lines = []
    for raw in page_text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if any(r.match(line) for r in NOISE_RE):
            continue
        lines.append(line)
    return lines

def extract_chapter(doc, start_p, end_p, ch_name, source_label):
    lines = []
    for p in range(start_p - 1, end_p - 1):
        for line in clean_lines(doc[p].get_text()):
            lines.append((p + 1, line))
            
    sol_idx = None
    for idx, (pno, text) in enumerate(lines):
        if SOLUTIONS_HEADER.match(text):
            sol_idx = idx
            break
            
    q_lines = lines[:sol_idx] if sol_idx is not None else lines
    sol_lines = lines[sol_idx:] if sol_idx is not None else []
    
    questions = {}
    current_qnum = None
    current_opt = None
    current_passage = None
    passage_acc = []
    current_dir_bounds = None
    
    for pno, line in q_lines:
        dm = DIRECTIONS_RE.match(line)
        if dm:
            s_n, e_n = int(dm.group(1)), int(dm.group(2))
            current_dir_bounds = (s_n, e_n)
            passage_acc = []
            if dm.group(3).strip():
                passage_acc.append(dm.group(3).strip())
            current_qnum = None
            current_opt = None
            continue

        qm = QNUM_RE.match(line)
        om = OPTION_RE.match(line)
        
        if qm:
            num = int(qm.group(1))
            if current_qnum is None or num == current_qnum + 1 or num == 1:
                current_qnum = num
                if current_dir_bounds and current_dir_bounds[0] <= current_qnum <= current_dir_bounds[1]:
                    current_passage = "\n".join(passage_acc).strip() if passage_acc else None
                else:
                    current_passage = None

                questions[current_qnum] = {
                    "num": current_qnum,
                    "qtext": qm.group(2).strip(),
                    "options": {},
                    "passage": current_passage,
                    "page": pno
                }
                current_opt = None
                continue
                
        if om and current_qnum in questions:
            current_opt = om.group(1)
            questions[current_qnum]["options"][current_opt] = om.group(2).strip()
            continue
            
        if current_qnum in questions:
            if current_opt and current_opt in questions[current_qnum]["options"]:
                questions[current_qnum]["options"][current_opt] += " " + line
            else:
                questions[current_qnum]["qtext"] += " " + line
        elif current_dir_bounds:
            passage_acc.append(line)

    # Parse solutions
    solutions = {}
    current_sol_num = None
    
    for pno, line in sol_lines:
        sm = SOL_ENTRY_RE.match(line)
        snm = SOL_NUM_RE.match(line)
        
        if sm:
            current_sol_num = int(sm.group(1))
            solutions[current_sol_num] = {
                "correct_option": sm.group(2).lower(),
                "sol_text": sm.group(3).strip()
            }
            continue

        if snm:
            current_sol_num = int(snm.group(1))
            solutions[current_sol_num] = {
                "correct_option": None,
                "sol_text": ""
            }
            continue

        if current_sol_num in solutions:
            if solutions[current_sol_num]["correct_option"] is None:
                som = SOL_OPT_RE.match(line)
                if som:
                    solutions[current_sol_num]["correct_option"] = som.group(1).lower()
                    solutions[current_sol_num]["sol_text"] = som.group(2).strip()
                    continue
            solutions[current_sol_num]["sol_text"] += " " + line

    extracted = []
    for qnum in sorted(questions.keys()):
        q = questions[qnum]
        opts = {k: strip_citation_suffix(v) for k, v in q["options"].items()}
        qtext = strip_citation_suffix(q["qtext"])
        passage = strip_citation_suffix(q["passage"]) if q["passage"] else None
        
        if len(opts) < 4:
            continue
            
        sol = solutions.get(qnum)
        if not sol or not sol.get("correct_option"):
            continue
            
        correct_opt = sol["correct_option"]
        if correct_opt not in opts:
            if 'a' in opts:
                correct_opt = 'a'
            else:
                continue

        sol_text = strip_citation_suffix(sol["sol_text"])
        if passage and (not sol_text or sol_text.startswith("Option (")):
            sol_text = f"Data / Context Setup:\n{passage}\n\nOption ({correct_opt}) is the correct answer."
        elif not sol_text:
            sol_text = f"Option ({correct_opt}) is the correct answer."

        ch_slug = ch_name.lower().replace(" / ", "-").replace(" ", "-")
        q_id = f"quant-{ch_slug[:6]}-{start_p:03d}-{qnum:04d}"

        item = {
            "id": q_id,
            "subject": "Quantitative Aptitude",
            "chapter": ch_name,
            "examTracks": ["prelims", "mains"],
            "passage": passage,
            "questionText": qtext,
            "options": opts,
            "correctOption": correct_opt,
            "solutionText": sol_text,
            "marks": 1,
            "negativeMarks": 0.25,
            "hasImage": False,
            "imageFile": None,
            "source": f"Ace Quant - {source_label} (Q{qnum})"
        }
        extracted.append(item)

    return extracted

def main():
    doc = fitz.open(PDF_PATH)
    all_quant_questions = []
    
    for start_p, end_p, ch_name, source_label in CHAPTER_MAP:
        ch_q = extract_chapter(doc, start_p, end_p, ch_name, source_label)
        all_quant_questions.extend(ch_q)
        print(f"Extracted {len(ch_q):3d} questions for [{ch_name}] ({source_label})")

    print(f"\nTotal Quant questions extracted: {len(all_quant_questions)}")
    
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_quant_questions, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
