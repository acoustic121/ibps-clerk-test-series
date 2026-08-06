import fitz
import re

pdfs = {
    "Reasoning": "/Users/aman.singh/Documents/banking/question bank/Ace reasoning.pdf",
    "Quant": "/Users/aman.singh/Documents/banking/question bank/ace quant Latest edition.pdf",
    "Static_GA": "/Users/aman.singh/Documents/banking/question bank/835 Ace Static Awareness eBook.pdf",
    "Computer": "/Users/aman.singh/Documents/banking/question bank/Computer_Godfather_Toppers_Handbook_ENGLISH_Medium_DATA_SAVER.pdf"
}

def inspect_pdf(name, path):
    doc = fitz.open(path)
    print(f"\n==================== {name} ({len(doc)} pages) ====================")
    
    chapters = []
    for i, page in enumerate(doc):
        text = page.get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for idx, line in enumerate(lines[:10]):
            if line.lower().startswith("chapter") or line.lower().startswith("ch-") or line.lower() == "chapter":
                snippet = " | ".join(lines[max(0, idx-1):min(len(lines), idx+4)])
                chapters.append((i + 1, line, snippet))
                break

    print(f"Found {len(chapters)} chapter headers:")
    for pno, line, snippet in chapters:
        print(f"Page {pno:3d} [{line}]: {snippet}")

if __name__ == "__main__":
    for name, path in pdfs.items():
        inspect_pdf(name, path)
