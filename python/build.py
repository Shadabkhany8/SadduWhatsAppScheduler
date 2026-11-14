"""Small Python helper to prepare a clean GitHub Pages deployment folder."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FILES = ["index.html", "style.css", "script.js", "manifest.json"]

def main():
    DIST.mkdir(exist_ok=True)
    for name in FILES:
        source = ROOT / name
        if not source.exists():
            raise FileNotFoundError(f"Required file missing: {source}")
        shutil.copy2(source, DIST / name)
    print(f"GitHub Pages files prepared in: {DIST}")
    print("Publish the contents of dist/ from your repository's Pages settings.")

if __name__ == "__main__":
    main()
