import fitz
import re

def analyze_pdf(pdf_path, name, sample_pages):
    doc = fitz.open(pdf_path)
    print(f"\n==================== Analyzing {name} ({len(doc)} pages) ====================")
    
    # 1. Print TOC or chapter detection
    for pno in sample_pages:
        if pno < 1 or pno > len(doc):
            continue
        page = doc[pno - 1]
        text = page.get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        print(f"\n--- {name} Page {pno} ({len(lines)} lines) ---")
        for line in lines[:15]:
            print("  ", line)

if __name__ == "__main__":
    analyze_pdf("/Users/aman.singh/Documents/banking/question bank/Ace reasoning.pdf", "Reasoning", [2, 25, 43, 79, 106, 137])
    analyze_pdf("/Users/aman.singh/Documents/banking/question bank/ace quant Latest edition.pdf", "Quant", [2, 33, 61, 83, 116])
    analyze_pdf("/Users/aman.singh/Documents/banking/question bank/835 Ace Static Awareness eBook.pdf", "Static GA", [2, 5, 56, 101, 107, 130])
