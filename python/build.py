"""
Saddu WhatsApp Scheduler - Project Build & Validation Script
Prepares and verifies the static distribution folder for GitHub Pages deployment.
"""

from pathlib import Path
import shutil
import sys
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
CORE_FILES = [
    "index.html",
    "style.css",
    "script.js",
    "manifest.json",
    "README.md"
]

def validate_files():
    """Verify all critical project files exist and are not empty."""
    print("--> Validating project files...")
    missing = []
    for file_name in CORE_FILES:
        file_path = ROOT / file_name
        if not file_path.exists():
            missing.append(f"Missing file: {file_name}")
        elif file_path.stat().st_size == 0:
            missing.append(f"Empty file: {file_name}")
        else:
            size_kb = file_path.stat().st_size / 1024
            print(f"  [OK] {file_name:<15} ({size_kb:.2f} KB)")
    
    if missing:
        for err in missing:
            print(f"  [FAIL] {err}", file=sys.stderr)
        return False
    return True

def validate_manifest():
    """Validate manifest.json format."""
    print("--> Checking manifest.json...")
    manifest_path = ROOT / "manifest.json"
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert data.get("name"), "Manifest must have 'name'"
        assert data.get("start_url"), "Manifest must have 'start_url'"
        print("  [OK] manifest.json is valid JSON with required PWA fields")
        return True
    except Exception as e:
        print(f"  [FAIL] manifest.json invalid: {e}", file=sys.stderr)
        return False

def validate_html():
    """Check index.html for correct relative paths and essential tags."""
    print("--> Checking index.html...")
    html_path = ROOT / "index.html"
    try:
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check relative link paths
        assert 'href="style.css"' in content, "Missing relative link to style.css"
        assert 'src="script.js"' in content, "Missing relative script tag to script.js"
        assert 'href="manifest.json"' in content, "Missing relative link to manifest.json"
        
        # Ensure no accidental localhost dependencies
        assert "localhost:" not in content, "Found hardcoded localhost in index.html"
        assert "127.0.0.1" not in content, "Found hardcoded 127.0.0.1 in index.html"
        
        print("  [OK] index.html passed relative asset and security checks")
        return True
    except AssertionError as e:
        print(f"  [FAIL] index.html check failed: {e}", file=sys.stderr)
        return False

def build_dist():
    """Build the clean dist/ folder for GitHub Pages."""
    print("--> Building dist/ directory...")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)

    for file_name in CORE_FILES:
        src = ROOT / file_name
        dest = DIST / file_name
        shutil.copy2(src, dest)
        print(f"  Copied {file_name} -> dist/{file_name}")

    print(f"\n[SUCCESS] Build complete! Distribution files prepared in: {DIST}")
    print("You can publish directly from the repository root OR from the dist/ folder.")

def main():
    print("=" * 60)
    print("  Saddu WhatsApp Scheduler - Static Build & Verification")
    print("=" * 60)
    
    if not validate_files():
        sys.exit(1)
    if not validate_manifest():
        sys.exit(1)
    if not validate_html():
        sys.exit(1)
        
    build_dist()
    print("=" * 60)

if __name__ == "__main__":
    main()
