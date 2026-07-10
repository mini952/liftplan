#!/usr/bin/env python3
"""
build_preview.py — bake an offline snapshot of the /data CSVs into index.html.

The deployed app always tries to fetch the live files in /data first. This
snapshot is only the fallback used when fetch() can't work (opening the file
directly from disk, or an in-chat preview). Re-run this after editing the CSVs
so the fallback doesn't go stale:

    python3 build_preview.py
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
TABLES = ["general_areas", "muscle_groups", "muscles", "exercises", "exercise_muscle"]

def main():
    blobs = {}
    for t in TABLES:
        p = ROOT / "data" / f"{t}.csv"
        if not p.exists():
            sys.exit(f"missing {p}")
        blobs[t] = base64.b64encode(p.read_bytes()).decode("ascii")

    obj = "{\n" + ",\n".join(f'  "{t}": "{b}"' for t, b in blobs.items()) + "\n}"
    html = (ROOT / "index.html").read_text()
    # Replace whatever currently sits between `EMBEDDED_DATA =` and the marker.
    new = re.sub(
        r"const EMBEDDED_DATA = .*?;\s*/\*__EMBED__\*/",
        f"const EMBEDDED_DATA = {obj};  /*__EMBED__*/",
        html,
        count=1,
        flags=re.S,
    )
    if new == html:
        sys.exit("marker `/*__EMBED__*/` not found in index.html")
    (ROOT / "index.html").write_text(new)
    kb = sum(len(b) for b in blobs.values()) / 1024
    print(f"Baked snapshot for {len(blobs)} tables (~{kb:.0f} KB base64) into index.html")

if __name__ == "__main__":
    main()
