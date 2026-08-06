import fitz
import re
import json
import os

PDF_PATH = "/Users/aman.singh/Documents/banking/question bank/Ace reasoning.pdf"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/reasoning-chapters.json"
IMAGES_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/images/reasoning"

os.makedirs(IMAGES_DIR, exist_ok=True)

CHAPTER_MAP = [
    (2, 25, "Alphanumeric Series", ["prelims", "mains"], "Ch 1 - Alphanumeric Series"),
    (76, 106, "Distance and Direction", ["prelims"], "Ch 4 - Distance and Direction"),
    (106, 157, "Coding-Decoding", ["prelims"], "Ch 7 - Coding-Decoding"),
    (157, 195, "Inequalities", ["prelims", "mains"], "Ch 2 - Inequalities"),
    (195, 241, "Blood Relations", ["prelims", "mains"], "Ch 5 - Blood Relations"),
    (241, 305, "Syllogism", ["prelims", "mains"], "Ch 3 - Syllogism"),
    (305, 334, "Input-Output", ["prelims", "mains"], "Ch 8 - Input-Output"),
    (334, 389, "Seating Arrangements", ["prelims", "mains"], "Ch 9 - Seating Arrangements"),
    (389, 446, "Puzzles", ["prelims", "mains"], "Ch 10 - Puzzles"),
    (446, 471, "Data Sufficiency", ["prelims", "mains"], "Ch 11 - Data Sufficiency"),
    (471, 495, "Order and Ranking", ["prelims", "mains"], "Ch 6 - Order & Ranking"),
]

NOISE_PATTERNS = [
    r"^A Complete Guide on Reasoning Ability for Banking Examinations\s*$",
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

def render_question_image(doc, page_num, q_id, ch_slug):
    ch_img_dir = os.path.join(IMAGES_DIR, ch_slug)
    os.makedirs(ch_img_dir, exist_ok=True)
    out_rel = f"reasoning/{ch_slug}/{q_id}.png"
    out_abs = os.path.join(IMAGES_DIR, ch_slug, f"{q_id}.png")
    
    page = doc[page_num - 1]
    pix = page.get_pixmap(dpi=150)
    pix.save(out_abs)
    return out_rel

def extract_chapter(doc, start_p, end_p, ch_name, tracks, source_label):
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
                
                # Check if we should finalize passage for current directions block
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
        prefix = sol.get("prefix", "")
        if prefix:
            if sol_text:
                sol_text = f"{prefix}\n\n{sol_text}"
            else:
                sol_text = f"{prefix}\n\nOption ({correct_opt}) is the correct answer."
        elif passage and (not sol_text or sol_text.startswith("Option (")):
            sol_text = f"Arrangement / Context Setup:\n{passage}\n\nOption ({correct_opt}) is the correct answer."
        elif not sol_text:
            sol_text = f"Option ({correct_opt}) is the correct answer."

        ch_slug = ch_name.lower().replace(" / ", "-").replace(" ", "-")
        q_id = f"reas-{ch_slug[:6]}-{start_p:03d}-{qnum:04d}"

        has_image = False
        img_rel_path = None
        if ch_name in ["Seating Arrangements", "Puzzles"] and not passage:
            has_image = True
            img_rel_path = render_question_image(doc, q["page"], q_id, ch_slug)

        item = {
            "id": q_id,
            "subject": "Reasoning & Computer Aptitude",
            "chapter": ch_name,
            "examTracks": tracks,
            "passage": passage,
            "questionText": qtext,
            "options": opts,
            "correctOption": correct_opt,
            "solutionText": sol_text,
            "marks": 1,
            "negativeMarks": 0.25,
            "hasImage": has_image,
            "imageFile": img_rel_path,
            "source": f"Ace Reasoning - {source_label} (Q{qnum})"
        }
        extracted.append(item)

    return extracted

def main():
    doc = fitz.open(PDF_PATH)
    all_reas_questions = []
    
    for start_p, end_p, ch_name, tracks, source_label in CHAPTER_MAP:
        ch_q = extract_chapter(doc, start_p, end_p, ch_name, tracks, source_label)
        all_reas_questions.extend(ch_q)
        print(f"Extracted {len(ch_q):3d} questions for [{ch_name}] ({source_label})")

    ds_mains = []
    for q in all_reas_questions:
        if q["chapter"] == "Distance and Direction":
            q_copy = dict(q)
            q_copy["id"] = q["id"].replace("reas-dista-", "reas-dirse-")
            q_copy["chapter"] = "Direction Sense"
            q_copy["examTracks"] = ["mains"]
            ds_mains.append(q_copy)
    all_reas_questions.extend(ds_mains)

    print(f"\nTotal Reasoning questions extracted: {len(all_reas_questions)}")
    
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_reas_questions, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
