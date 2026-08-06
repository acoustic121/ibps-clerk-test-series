"""
Pilot extractor: Reading Comprehension chapter from 'Ace English 3rd edition .pdf'
Produces server/data/questions/prelims-mains_english_reading-comprehension.json

Book structure discovered by inspection:
 - Chapter starts at page 119 (0-indexed), next chapter 'Cloze Test' starts at page 186.
 - An intro example passage (pages 120-122) has INLINE 'Solution (x); ...' right after each question.
 - Then four labelled TYPE sections, each a series of 'Directions (a-b):' blocks sharing one
   continuously-incrementing question numbering per TYPE:
     TYPE I  - CONVENTIONAL         -> Q1-17
     TYPE II - PARAGRAPH BASED      -> Q18-32
     TYPE III- MULTIPLE PASSAGE     -> Q33-47
     TYPE IV - COMPREHENSIVE PASSAGE-> Q48-57
   Their solutions live together under one 'Solutions' heading (page ~166), split into four
   sub-labelled chunks ('Conventional RC', 'PARAGRAPH BASED', 'MULTIPLE RC', 'COMPREHENSIVE RC')
   whose entries are keyed by that SAME absolute number (1-57), so lookup is by number directly.
 - After TYPE IV (page 137 onward) there are many more independent 'Directions (a-b):' blocks
   with NO type label, each restarting its own local numbering (e.g. 1-8, then 1-8, then 1-6...).
   Their solutions appear after the four labelled chunks, as anonymous chunks whose numbering
   also restarts each time a number decreases. These are matched to blocks IN ORDER.
"""
import fitz
import re
import json
import os
import sys

PDF_PATH = "/Users/aman.singh/Documents/banking/question bank/Ace English 3rd edition .pdf"
OUT_PATH = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions/reading-comprehension.json"
IMAGES_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/images/reading-comprehension"

CHAPTER_START_PAGE = 119
CHAPTER_END_PAGE = 186  # exclusive

NOISE_PATTERNS = [
    r"^A Complete Guide on English Language for Banking Examinations\s*$",
    r"^Adda247 Publications.*$",
    r"^Visit:\s*adda247\.com\s*$",
    r"^@cetexamgroup\s*$",
    r"^Join channel\s*$",
    r"^\d+\s*$",  # bare page number line
]
NOISE_RE = [re.compile(p) for p in NOISE_PATTERNS]

TYPE_HEADER_RE = re.compile(r"^TYPE\s*[IVX]+\s*[-–]\s*(.+)$")
DIRECTIONS_RE = re.compile(r"^Directions?\s*\((\d+)\s*[-–]\s*(\d+)\)\s*:?(.*)$")
QNUM_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
OPTION_RE = re.compile(r"^\(([a-e])\)\s*(.*)$")
SOLUTIONS_HEADING_RE = re.compile(r"^Solutions\s*$")
SOL_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s*\(([a-e])\)\s*[:;]?\s*(.*)$")

CITATION_SUFFIX_RE = re.compile(
    r"(\s*(IBPS|SBI|RBI|RRB|SSC)\s+(PO|CLERK|SO|SPECIALIST OFFICER)\s+"
    r"(PRE|PRELIMS|MAINS)\s+\d{4}\s*)+$",
    re.I,
)


def strip_citation_suffix(text):
    """The source books sometimes tack the exam name/year the passage was taken from directly
    onto the end of the last option's text (e.g. '...None of these IBPS CLERK PRE 2019'). Strip
    it only when it's a trailing tag, so genuine mentions of RBI/IBPS mid-sentence are untouched."""
    if not text:
        return text
    return CITATION_SUFFIX_RE.sub("", text).strip()


KNOWN_LABELS = {
    "conventional rc": "TYPE I- CONVENTIONAL",
    "paragraph based": "TYPE II- PARAGRAPH BASED",
    "multiple rc": "TYPE III- MULTIPLE PASSAGE",
    "comprehensive rc": "TYPE IV- COMPREHENSIVE PASSAGE",
}


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


def load_chapter_lines(doc):
    all_lines = []
    for pno in range(CHAPTER_START_PAGE, CHAPTER_END_PAGE):
        for line in clean_lines(doc[pno].get_text()):
            all_lines.append((pno, line))
    return all_lines


def parse_questions_region(lines):
    """
    lines: list of (pageno, text) before the 'Solutions' heading.
    Returns: list of blocks: {type_label, start, end, passage, questions: {num: {text, options}}}
    Also returns the intro example block separately (has inline solutions).
    """
    blocks = []
    intro_questions = {}  # num -> {"text":..., "options": {...}, "inline_solution": (letter, text)}
    current_type_label = None
    running_max = 0  # last question number covered by the current contiguous type-labelled run
    i = 0
    n = len(lines)

    # --- Phase 1: intro example passage (before the first 'TYPE' header line) ---
    first_type_idx = None
    for idx, (_, text) in enumerate(lines):
        if TYPE_HEADER_RE.match(text):
            first_type_idx = idx
            break
    intro_lines = lines[:first_type_idx] if first_type_idx else []
    intro_questions = parse_intro_example(intro_lines)

    i = first_type_idx if first_type_idx is not None else n

    while i < n:
        pageno, text = lines[i]
        type_m = TYPE_HEADER_RE.match(text)
        if type_m:
            current_type_label = text.strip()
            i += 1
            continue

        dir_m = DIRECTIONS_RE.match(text)
        if not dir_m:
            i += 1
            continue

        start_num, end_num = int(dir_m.group(1)), int(dir_m.group(2))

        if current_type_label is not None and start_num != running_max + 1:
            # numbering broke contiguity -> this and all following blocks are untyped
            # until an explicit new TYPE header is seen again.
            current_type_label = None
        block = {
            "type_label": current_type_label,
            "start": start_num,
            "end": end_num,
            "passage_lines": [],
            "questions": {},
            "first_page": pageno,
        }
        i += 1

        # Skip trailing directions continuation lines (e.g. "answer the questions given below them...")
        # until we hit either passage content or the first question number == start_num.
        # Passage = everything until a line matching QNUM_RE with num == start_num.
        passage_lines = []
        while i < n:
            pageno, text = lines[i]
            qm = QNUM_RE.match(text)
            if qm and int(qm.group(1)) == start_num:
                break
            if TYPE_HEADER_RE.match(text) or DIRECTIONS_RE.match(text) or SOLUTIONS_HEADING_RE.match(text):
                break
            passage_lines.append(text)
            i += 1
        block["passage_lines"] = passage_lines

        # Now parse questions start_num..end_num. Keep consuming lines (options/continuations)
        # for the LAST question even after `expected` passes end_num - only stop on a genuine
        # structural boundary (new Directions/TYPE/Solutions marker).
        expected = start_num
        current_q = None
        current_opt = None
        while i < n:
            pageno, text = lines[i]
            if TYPE_HEADER_RE.match(text) or SOLUTIONS_HEADING_RE.match(text):
                break
            next_dir = DIRECTIONS_RE.match(text)
            qm = QNUM_RE.match(text)
            om = OPTION_RE.match(text)

            if next_dir and current_q is not None:
                # next block begins right after this one ends
                break
            if qm and expected <= end_num and int(qm.group(1)) == expected:
                current_q = {"text": qm.group(2).strip(), "options": {}}
                block["questions"][expected] = current_q
                current_opt = None
                expected += 1
                i += 1
                continue
            if om and current_q is not None:
                current_opt = om.group(1)
                current_q["options"][current_opt] = om.group(2).strip()
                i += 1
                continue
            # continuation line
            if current_q is None:
                i += 1
                continue
            if current_opt is not None:
                current_q["options"][current_opt] += " " + text
            else:
                current_q["text"] += " " + text
            i += 1

        if block["type_label"] is not None:
            running_max = end_num

        blocks.append(block)

    return intro_questions, blocks


def parse_intro_example(intro_lines):
    """Parse the very first RC example passage which has inline 'Solution (x); ...' per question.

    A question's own text can contain numbered sub-statements ('1. Check on...', '2. Enhancement...')
    that also match QNUM_RE. Only treat a line as a NEW question header when its number is exactly
    the next expected one (same guard as the main block parser), so those sub-statements are treated
    as continuation text of the real question instead of spawning bogus overwritten entries.
    """
    texts = [t for _, t in intro_lines]

    # The chapter's opening pep-talk also contains its own numbered tips ('1. A complaint...',
    # '2. Find your strengths...') which match QNUM_RE but are never followed by lettered options.
    # Find the first QNUM_RE line that IS immediately followed by an '(a)' option - that's the
    # real start of the worked example, and everything before it is instructional prose to discard.
    real_start = None
    for idx in range(len(texts) - 1):
        qm = QNUM_RE.match(texts[idx])
        om = OPTION_RE.match(texts[idx + 1])
        if qm and int(qm.group(1)) == 1 and om and om.group(1) == "a":
            real_start = idx
            break
    texts = texts[real_start:] if real_start is not None else []

    questions = {}
    i = 0
    n = len(texts)
    current_q = None
    current_opt = None
    expected = 1
    while i < n:
        text = texts[i]
        qm = QNUM_RE.match(text)
        om = OPTION_RE.match(text)
        solm = re.match(r"^Solution\s*\(([a-e])\)\s*[:;]?\s*(.*)$", text)
        if qm and int(qm.group(1)) == expected:
            num = expected
            current_q = {"text": qm.group(2).strip(), "options": {}, "solution": None}
            questions[num] = current_q
            current_opt = None
            expected += 1
        elif om and current_q is not None and current_q["solution"] is None:
            current_opt = om.group(1)
            current_q["options"][current_opt] = om.group(2).strip()
        elif solm and current_q is not None:
            current_q["solution"] = (solm.group(1), solm.group(2).strip())
            current_opt = None
        elif current_q is not None:
            if current_q["solution"] is not None:
                current_q["solution"] = (current_q["solution"][0], current_q["solution"][1] + " " + text)
            elif current_opt is not None:
                current_q["options"][current_opt] += " " + text
            else:
                current_q["text"] += " " + text
        i += 1
    return questions


def parse_solutions_region(lines):
    """
    lines: list of (pageno, text) from the 'Solutions' heading (exclusive) to chapter end.
    Returns ordered list of chunks: {"label": str|None, "entries": {num: (letter, text)}}
    """
    chunks = []
    current_chunk = None
    last_num = 0
    for pageno, text in lines:
        m = SOL_ENTRY_RE.match(text)
        label_m = None
        stripped = text.strip()
        if stripped.lower() in KNOWN_LABELS:
            label_m = stripped

        if label_m:
            current_chunk = {"label": label_m, "entries": {}}
            chunks.append(current_chunk)
            last_num = 0
            continue

        if m:
            num = int(m.group(1))
            letter = m.group(2)
            body = m.group(3).strip()
            if current_chunk is None or num <= last_num:
                current_chunk = {"label": None, "entries": {}}
                chunks.append(current_chunk)
            current_chunk["entries"][num] = [letter, body]
            last_num = num
            continue

        # continuation line -> append to last entry's text
        if current_chunk and current_chunk["entries"]:
            last_key = max(current_chunk["entries"].keys())
            current_chunk["entries"][last_key][1] += " " + text

    return chunks


def build_dataset():
    doc = fitz.open(PDF_PATH)
    all_lines = load_chapter_lines(doc)

    sol_idx = None
    for idx, (_, text) in enumerate(all_lines):
        if SOLUTIONS_HEADING_RE.match(text):
            sol_idx = idx
            break
    assert sol_idx is not None, "Could not find Solutions heading"

    question_lines = all_lines[:sol_idx]
    solution_lines = all_lines[sol_idx + 1 :]

    intro_questions, blocks = parse_questions_region(question_lines)
    sol_chunks = parse_solutions_region(solution_lines)

    labelled_chunks = [c for c in sol_chunks if c["label"]]
    anon_chunks = [c for c in sol_chunks if not c["label"]]

    typed_blocks = [b for b in blocks if b["type_label"]]
    anon_blocks = [b for b in blocks if not b["type_label"]]

    # group typed_blocks by type_label preserving order of first appearance
    type_order = []
    for b in typed_blocks:
        if b["type_label"] not in type_order:
            type_order.append(b["type_label"])

    issues = []
    dataset = []
    qid = 0

    def make_question(num, qtext, options, correct, solution_text, passage, source_note, has_image=False):
        nonlocal qid
        qid += 1
        cleaned_options = {k: strip_citation_suffix(v) for k, v in options.items()}
        return {
            "id": f"eng-rc-{qid:04d}",
            "subject": "English Language",
            "chapter": "Reading Comprehension",
            "examTracks": ["prelims", "mains"],
            "passage": strip_citation_suffix(passage),
            "questionText": strip_citation_suffix(qtext),
            "options": cleaned_options,
            "correctOption": correct,
            "solutionText": solution_text,
            "marks": 1,
            "negativeMarks": 0.25,
            "hasImage": has_image,
            "source": source_note,
        }

    # 1. Intro example
    for num in sorted(intro_questions):
        q = intro_questions[num]
        if not q["solution"] or len(q["options"]) < 4:
            issues.append(f"intro Q{num} incomplete: options={len(q['options'])} solution={bool(q['solution'])}")
            continue
        letter, sol_text = q["solution"]
        dataset.append(
            make_question(num, q["text"], q["options"], letter, sol_text, None, "Ace English 3rd ed. - RC intro example")
        )

    # 2. Typed blocks: match by order to labelled solution chunks
    for i, type_label in enumerate(type_order):
        group_blocks = [b for b in typed_blocks if b["type_label"] == type_label]
        if i >= len(labelled_chunks):
            issues.append(f"No solution chunk for type '{type_label}'")
            continue
        chunk = labelled_chunks[i]
        for b in group_blocks:
            passage = " ".join(b["passage_lines"]).strip() or None
            for num, q in b["questions"].items():
                entry = chunk["entries"].get(num)
                if not entry or len(q["options"]) < 4:
                    issues.append(
                        f"{type_label} Q{num} (p.{b['first_page']}) incomplete: "
                        f"options={len(q['options'])} solutionFound={bool(entry)}"
                    )
                    continue
                letter, sol_text = entry
                dataset.append(
                    make_question(
                        num, q["text"], q["options"], letter, sol_text, passage,
                        f"Ace English 3rd ed. - {type_label} (p.{b['first_page']})",
                    )
                )

    # 3. Anonymous blocks: the book's own local numbering resets don't line up 1:1 with the
    # solution region's reset points (a passage's questions/answers sometimes get split across
    # more than one 'Directions' instruction). Both sides are still in strict document order and
    # cover the exact same set of questions, so flatten each into an ordered stream and zip by
    # position instead of trying to match block-for-block.
    flat_q = []
    for b in anon_blocks:
        passage = " ".join(b["passage_lines"]).strip() or None
        for num in sorted(b["questions"]):
            flat_q.append((b, num, b["questions"][num], passage))
    flat_sol = []
    for chunk in anon_chunks:
        for num in sorted(chunk["entries"]):
            flat_sol.append(chunk["entries"][num])

    if len(flat_q) != len(flat_sol):
        issues.append(
            f"Anon flattened count mismatch: {len(flat_q)} questions vs {len(flat_sol)} solutions "
            "(some anon questions/solutions could not be matched positionally)"
        )

    for (b, num, q, passage), entry in zip(flat_q, flat_sol):
        if len(q["options"]) < 4:
            issues.append(f"anon block p.{b['first_page']} Q{num} incomplete: options={len(q['options'])}")
            continue
        letter, sol_text = entry
        dataset.append(
            make_question(
                num, q["text"], q["options"], letter, sol_text, passage,
                f"Ace English 3rd ed. - practice set (p.{b['first_page']})",
            )
        )

    return dataset, issues


if __name__ == "__main__":
    dataset, issues = build_dataset()
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(dataset)} questions to {OUT_PATH}")
    print(f"Issues: {len(issues)}")
    for iss in issues[:50]:
        print(" -", iss)
