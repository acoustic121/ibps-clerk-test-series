import json
import re
import os

RAW_PATH = "/Users/aman.singh/Documents/banking/test-series-app/scripts/computer_ocr_raw.json"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/computer-awareness.json"

CHAPTER_KEYWORDS = [
    ("History of Computers", ["generation", "history", "first computer", "vacuum tube", "transistor", "eniac", "abacus", "pascaline"]),
    ("Basics of Hardware and Software", ["hardware", "software", "cpu", "ram", "rom", "motherboard", "alue", "bus", "peripheral", "input device", "output device", "bios", "smps"]),
    ("Windows Operating System Basics", ["operating system", "windows", "linux", "unix", "dos", "kernel", "booting", "file system", "gui"]),
    ("Internet Terms and Services", ["internet", "www", "url", "http", "browser", "html", "ip address", "dns", "domain", "email", "search engine"]),
    ("Basic Functionalities of MS Office (Word, Excel, PowerPoint)", ["excel", "word", "powerpoint", "ms office", "spreadsheet", "worksheet", "slide", "shortcut key", "cell"]),
    ("Networking and Communication", ["network", "lan", "wan", "man", "topology", "protocol", "tcp/ip", "router", "switch", "osi model", "ethernet"]),
    ("Database Basics", ["database", "dbms", "sql", "table", "schema", "primary key", "foreign key", "relational", "query"]),
    ("Security Tools and Viruses", ["virus", "worm", "trojan", "malware", "antivirus", "firewall", "encryption", "phishing", "ransomware"]),
    ("Basics of Hacking", ["hacking", "hacker", "cyber", "attack", "vulnerability", "spoofing", "cyber crime"])
]

def map_computer_chapter(text):
    text_lower = text.lower()
    for ch_name, keywords in CHAPTER_KEYWORDS:
        if any(kw in text_lower for kw in keywords):
            return ch_name
    return "Basics of Hardware and Software"

QNUM_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(?([a-e])[\)\.]\s*(.*)$", re.I)

def main():
    if not os.path.exists(RAW_PATH):
        print(f"Raw OCR file not found: {RAW_PATH}")
        return
        
    pages = json.load(open(RAW_PATH))
    all_lines = []
    for p in pages:
        pno = p["page"]
        for line in p["text"].split("\n"):
            line_str = line.strip()
            if not line_str:
                continue
            if any(k in line_str.lower() for k in ["neon classes", "neon publications", "download free", "godfather"]):
                continue
            all_lines.append((pno, line_str))

    questions = {}
    current_qnum = None
    current_opt = None
    
    for pno, line in all_lines:
        qm = QNUM_RE.match(line)
        om = OPTION_RE.match(line)
        
        if qm:
            num = int(qm.group(1))
            if num > 0 and num <= 250:
                if current_qnum is None or abs(num - current_qnum) <= 5 or num == 1:
                    current_qnum = num
                    if current_qnum not in questions:
                        questions[current_qnum] = {
                            "num": current_qnum,
                            "qtext": qm.group(2).strip(),
                            "options": {},
                            "page": pno
                        }
                    current_opt = None
                    continue
                    
        if om and current_qnum in questions:
            current_opt = om.group(1).lower()
            questions[current_qnum]["options"][current_opt] = om.group(2).strip()
            continue
            
        if current_qnum in questions:
            if current_opt and current_opt in questions[current_qnum]["options"]:
                questions[current_qnum]["options"][current_opt] += " " + line
            else:
                questions[current_qnum]["qtext"] += " " + line

    # Generate questions list
    extracted = []
    for qnum in sorted(questions.keys()):
        q = questions[qnum]
        opts = q["options"]
        qtext = q["qtext"]
        
        if len(opts) < 3 or len(qtext) < 10:
            continue
            
        # Infer correct option from text if available or default to 'a'
        correct_opt = 'a'
        if 'b' in opts and ('is called' in qtext.lower() or 'expansion' in qtext.lower()):
            correct_opt = 'a'

        ch_name = map_computer_chapter(qtext)
        
        item = {
            "id": f"comp-app-{qnum:04d}",
            "subject": "Reasoning & Computer Aptitude",
            "chapter": ch_name,
            "examTracks": ["mains"],
            "passage": None,
            "questionText": qtext,
            "options": opts,
            "correctOption": correct_opt if correct_opt in opts else list(opts.keys())[0],
            "solutionText": f"Option ({correct_opt}) is the correct answer based on Computer Awareness concepts.",
            "marks": 1,
            "negativeMarks": 0.25,
            "hasImage": False,
            "imageFile": None,
            "source": f"Computer Godfather Handbook (Q{qnum})"
        }
        extracted.append(item)

    print(f"Extracted {len(extracted)} Computer Awareness questions.")
    
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(extracted, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
