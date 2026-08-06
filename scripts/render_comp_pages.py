import fitz
import os

pdf_path = "/Users/aman.singh/Documents/banking/question bank/Computer_Godfather_Toppers_Handbook_ENGLISH_Medium_DATA_SAVER.pdf"
out_dir = "/tmp/comp_pages"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"Rendering {len(doc)} pages to PNG...")
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"page_{i+1:03d}.png"))

print(f"Rendered {len(doc)} pages to {out_dir}")
