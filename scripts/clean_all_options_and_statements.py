import json
import glob
import os
import re

Q_DIR = "/Users/aman.singh/Documents/banking/test-series-app/server/data/questions"

# Regex to detect inline option markers like (b), (c), (d), (e), (a)
INLINE_OPT_RE = re.compile(r"\s+\(([a-eA-E])\)\s+")

# Regex to detect statements like (A), (B), (C) or I., II., III. or (i), (ii), (iii)
STATEMENT_SPLIT_RE = re.compile(r"(?<=\S)\s+(\(([A-Ea-e])\)|[I|V|X]+\.|\(([i|v|x]+)\))\s+(?=\S)")

def split_and_clean_options(options_dict):
    """
    Given a dict like {"a": "10 (b) 20 (c) 30", "b": "Option (B)", ...}
    Splits embedded options and produces a clean 5-key dict: {"a": "...", "b": "...", "c": "...", "d": "...", "e": "..."}
    """
    cleaned = dict(options_dict)
    
    # 1. Flatten all option text line by line
    raw_chunks = []
    for k in ["a", "b", "c", "d", "e"]:
        val = cleaned.get(k, "")
        if val and not val.startswith("Option (") and val != "(A)" and val != "(B)" and val != "(C)" and val != "(D)":
            raw_chunks.append(f"({k}) {val}")

    full_line = " ".join(raw_chunks).strip()
    if not full_line:
        return options_dict

    # 2. Extract key-value pairs using regex
    # Matches (a) text (b) text ...
    matches = re.finditer(r"\(([a-eA-E])\)\s*(.*?)(?=\s*\([a-eA-E]\)|$)", full_line)
    extracted = {}
    for m in matches:
        key = m.group(1).lower()
        text = m.group(2).strip()
        if text:
            # Strip trailing option tags if any residual
            text = re.sub(r"\s*\([a-eA-E]\)\s*$", "", text).strip()
            extracted[key] = text

    # 3. Merge extracted back into cleaned dict
    for k in ["a", "b", "c", "d", "e"]:
        if k in extracted and extracted[k]:
            v = extracted[k]
            if "Choose the option" in v or "INCORRECT" in v or "INAPPROPRIATE" in v:
                cleaned[k] = "No change required"
            else:
                cleaned[k] = v
        elif k not in cleaned or cleaned[k].startswith("Option ("):
            cleaned[k] = f"Option ({k.upper()})"
        elif k == "e" and ("Choose the option" in cleaned[k] or "INCORRECT" in cleaned[k] or "INAPPROPRIATE" in cleaned[k]):
            cleaned[k] = "No change required"

    return cleaned

def format_statements_in_text(text):
    """
    Inserts clean newlines before sub-statements like (A), (B), (C), I., II., III., (i), (ii)
    """
    if not text:
        return text

    # Replace inline statements with \n\n(A), \n\nI., etc.
    formatted = STATEMENT_SPLIT_RE.sub(r"\n\n\1 ", text)
    return formatted.strip()

def main():
    json_files = sorted(glob.glob(os.path.join(Q_DIR, "*.json")))
    total_fixed_options = 0
    total_fixed_statements = 0

    print(f"Scanning and cleaning options and statements in {len(json_files)} files...")

    for fpath in json_files:
        fname = os.path.basename(fpath)
        data = json.load(open(fpath, "r", encoding="utf-8"))
        file_fixed_opt = 0
        file_fixed_stmt = 0

        for q in data:
            # 1. Clean options
            opts = q.get("options")
            if isinstance(opts, dict):
                has_embedded = any(INLINE_OPT_RE.search(str(v)) for v in opts.values()) or any("Choose the option" in str(v) or "INCORRECT" in str(v) for v in opts.values())
                if has_embedded:
                    q["options"] = split_and_clean_options(opts)
                    file_fixed_opt += 1
                for k, v in q["options"].items():
                    if "Choose the option" in str(v) or "INCORRECT" in str(v) or "INAPPROPRIATE" in str(v):
                        q["options"][k] = "No change required"
                    elif k == "a" and v.strip() == "to":
                        q["options"][k] = "shape, along, causing"
            elif isinstance(opts, list):
                # Convert list format to dict format if any
                opt_dict = {}
                for item in opts:
                    opt_dict[item["key"].lower()] = item["text"]
                has_embedded = any(INLINE_OPT_RE.search(str(v)) for v in opt_dict.values())
                if has_embedded:
                    new_dict = split_and_clean_options(opt_dict)
                    q["options"] = new_dict
                    file_fixed_opt += 1

            # 2. Format statements in questionText
            qtext = q.get("questionText", "")
            if qtext and STATEMENT_SPLIT_RE.search(qtext):
                q["questionText"] = format_statements_in_text(qtext)
                file_fixed_stmt += 1

            # 3. Format statements in passage
            passage = q.get("passage", "")
            if passage and STATEMENT_SPLIT_RE.search(passage):
                q["passage"] = format_statements_in_text(passage)
                file_fixed_stmt += 1

        total_fixed_options += file_fixed_opt
        total_fixed_statements += file_fixed_stmt

        print(f"  - {fname}: Fixed {file_fixed_opt} option-squishing issues, {file_fixed_stmt} statement formatting issues")

        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSUCCESS! Fixed total {total_fixed_options} option issues and {total_fixed_statements} statement formatting issues across all files.")

if __name__ == "__main__":
    main()
