import fitz
import re

def inspect_reasoning():
    doc = fitz.open("/Users/aman.singh/Documents/banking/question bank/Ace reasoning.pdf")
    print(f"\n==================== Reasoning ({len(doc)} pages) ====================")
    ch_pages = []
    for i in range(len(doc)):
        text = doc[i].get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for idx, line in enumerate(lines[:10]):
            if line.lower() == "chapter" or line.lower().startswith("chapter"):
                ch_pages.append((i+1, lines[:min(10, len(lines))]))
                break
    for pno, snippet in ch_pages:
        print(f"Page {pno:3d}: {' | '.join(snippet[:5])}")

def inspect_computer():
    doc = fitz.open("/Users/aman.singh/Documents/banking/question bank/Computer_Godfather_Toppers_Handbook_ENGLISH_Medium_DATA_SAVER.pdf")
    print(f"\n==================== Computer ({len(doc)} pages) ====================")
    for i in range(min(15, len(doc))):
        text = doc[i].get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        print(f"--- Page {i+1} ---")
        for l in lines[:10]:
            print("  ", l)

if __name__ == "__main__":
    inspect_reasoning()
    inspect_computer()
