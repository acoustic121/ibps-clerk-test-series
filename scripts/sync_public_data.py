import json
import glob
import os
import shutil

# Paths relative to repo root (works locally and on CI runners)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DATA = os.path.join(REPO_ROOT, "server", "data")
CLIENT_PUBLIC_DATA = os.path.join(REPO_ROOT, "client", "public", "data")

def main():
    os.makedirs(CLIENT_PUBLIC_DATA, exist_ok=True)
    
    # 1. Copy syllabus.json
    shutil.copy(os.path.join(SERVER_DATA, "syllabus.json"), os.path.join(CLIENT_PUBLIC_DATA, "syllabus.json"))
    
    # 2. Copy images folder
    images_src = os.path.join(SERVER_DATA, "images")
    images_dst = os.path.join(CLIENT_PUBLIC_DATA, "images")
    if os.path.exists(images_src):
        if os.path.exists(images_dst):
            shutil.rmtree(images_dst)
        shutil.copytree(images_src, images_dst)

    # 3. Consolidate all questions into all_questions.json
    q_files = glob.glob(os.path.join(SERVER_DATA, "questions", "*.json"))
    all_q = []
    for fpath in sorted(q_files):
        data = json.load(open(fpath))
        all_q.extend(data)

    with open(os.path.join(CLIENT_PUBLIC_DATA, "all_questions.json"), "w", encoding="utf-8") as f:
        json.dump(all_q, f, ensure_ascii=False)

    print(f"Synced syllabus, images, and {len(all_q)} questions to {CLIENT_PUBLIC_DATA}")

if __name__ == "__main__":
    main()
