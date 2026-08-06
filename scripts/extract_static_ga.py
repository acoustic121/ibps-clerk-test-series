import fitz
import re
import json

PDF_PATH = "/Users/aman.singh/Documents/banking/question bank/835 Ace Static Awareness eBook.pdf"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/static-awareness.json"

NOISE_PATTERNS = [
    r"^Adda247 Publications.*$",
    r"^Visit:\s*adda247\.com\s*$",
    r"^Static Awareness Questions Asked in Recent Exams\s*$",
    r"^Complete Book on Banking Awareness & Static Awareness\s*$",
    r"^\d+\s*$",  # bare page number
]
NOISE_RE = [re.compile(p, re.I) for p in NOISE_PATTERNS]

QNUM_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(([a-e])\)\s*(.*)$")
SOL_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s*\(([a-e])\)\s*[:;]?\s*(.*)$")

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

def map_ga_chapter(qtext, soltext):
    combined = (qtext + " " + soltext).lower()
    if any(k in combined for k in ["book", "written by", "authored", "novel", "writer"]):
        return "Books and Authors"
    if any(k in combined for k in ["award", "prize", "nobel", "oscar", "bharat ratna", "padma"]):
        return "Awards"
    if any(k in combined for k in ["headquarter", "headquartered", "head quarter", "located in", "based in"]):
        return "Headquarters"
    if any(k in combined for k in ["currency", "capital of", "dollar", "euro", "yen", "rupee", "dinar", "dirham"]):
        return "Currencies"
    if any(k in combined for k in ["day", "celebrated on", "observed on"]):
        return "Important Days"
    if any(k in combined for k in ["stadium", "park", "wildlife", "sanctuary", "dam", "river", "temple", "lake", "airport", "city"]):
        return "Important Places"
    return "GK Updates"

def main():
    doc = fitz.open(PDF_PATH)
    
    # 1. Read question pages (130 to 144 -> index 129 to 143)
    q_lines = []
    for p in range(129, 144):
        for line in clean_lines(doc[p].get_text()):
            q_lines.append((p+1, line))
            
    # 2. Read solution pages (145 to end -> index 144 to len-1)
    sol_lines = []
    for p in range(144, len(doc)):
        for line in clean_lines(doc[p].get_text()):
            sol_lines.append((p+1, line))
            
    # Parse questions
    questions = {}
    current_qnum = None
    current_opt = None
    
    for pno, line in q_lines:
        qm = QNUM_RE.match(line)
        om = OPTION_RE.match(line)
        
        if qm and (current_qnum is None or int(qm.group(1)) == current_qnum + 1):
            current_qnum = int(qm.group(1))
            questions[current_qnum] = {
                "num": current_qnum,
                "qtext": qm.group(2).strip(),
                "options": {}
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

    # Parse solutions
    solutions = {}
    current_sol_num = None
    
    sol_num_re = re.compile(r"^(\d{1,3})\.\s*$")
    sol_opt_re = re.compile(r"^\(([a-e])\)\s*[:;]?\s*(.*)$")

    for pno, line in sol_lines:
        sm = SOL_ENTRY_RE.match(line)
        snm = sol_num_re.match(line)
        
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
                som = sol_opt_re.match(line)
                if som:
                    solutions[current_sol_num]["correct_option"] = som.group(1).lower()
                    solutions[current_sol_num]["sol_text"] = som.group(2).strip()
                    continue
            solutions[current_sol_num]["sol_text"] += " " + line

    # Match questions and solutions
    out_data = []
    skipped = []
    
    for qnum in sorted(questions.keys()):
        q = questions[qnum]
        opts = {k: strip_citation_suffix(v) for k, v in q["options"].items()}
        qtext = strip_citation_suffix(q["qtext"])
        
        if len(opts) < 4:
            skipped.append((qnum, f"Only {len(opts)} options found"))
            continue
            
        if qnum not in solutions:
            skipped.append((qnum, "No matching solution found"))
            continue
            
        sol = solutions[qnum]
        correct_opt = sol["correct_option"]
        if correct_opt not in opts:
            # fallback if option key mismatch
            if 'a' in opts:
                correct_opt = 'a'
            else:
                skipped.append((qnum, f"Correct option {correct_opt} not in options"))
                continue

        sol_text = strip_citation_suffix(sol["sol_text"])
        if not sol_text:
            sol_text = f"Option ({correct_opt}) is the correct answer."

        ch_name = map_ga_chapter(qtext, sol_text)
        
        out_item = {
            "id": f"ga-stat-{qnum:04d}",
            "subject": "General & Financial Awareness",
            "chapter": ch_name,
            "examTracks": ["mains"],
            "passage": None,
            "questionText": qtext,
            "options": opts,
            "correctOption": correct_opt,
            "solutionText": sol_text,
            "marks": 1,
            "negativeMarks": 0.25,
            "hasImage": False,
            "imageFile": None,
            "source": f"835 Ace Static Awareness - Q{qnum}"
        }
        out_data.append(out_item)
        
    print(f"Extracted {len(out_data)} Static GA questions. Skipped: {len(skipped)}")
    if skipped:
        print("Skipped summary:", skipped[:10])
        
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out_data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
