#!/usr/bin/env python3
"""Build the distributable Chrome extension ZIP, and read release notes.

Stock Python, no dependencies, same as everything else here:

    python3 scripts/package.py zip              # -> dist/meeting-burn-<version>.zip
    python3 scripts/package.py notes 1.1.0      # the CHANGELOG section for a version
    python3 scripts/package.py version          # the version in manifest.json

The ZIP is what both distribution paths want:

* **Unpacked** — unzip it anywhere and point *Load unpacked* at the folder.
* **Chrome Web Store** — upload the ZIP as-is. The store requires manifest.json at
  the archive root and rejects anything it can't account for, so only the files the
  extension actually runs are included. Documentation, CI config and the git history
  are left out on purpose.

Entries are written in a fixed order with a fixed timestamp, so the same commit
always produces a byte-identical archive.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Everything the extension needs at runtime, and nothing else. verify.py reads this
# list too, so a file that goes missing fails CI before it fails a release.
PACKAGE: tuple[str, ...] = (
    "manifest.json",
    "index.html",
    "app.css",
    "app.js",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "LICENSE",
)

# ZIP epoch. Any fixed value works; this one is the format's own floor.
FIXED_DATE = (1980, 1, 1, 0, 0, 0)


def version() -> str:
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]


def notes(for_version: str) -> str:
    """The body of one `## [x.y.z]` section of CHANGELOG.md, without its heading."""
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    pattern = rf"^## \[{re.escape(for_version)}\][^\n]*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, changelog, re.S | re.M)
    if not match:
        raise SystemExit(
            f"error: CHANGELOG.md has no '## [{for_version}]' section.\n"
            f"       Move the Unreleased entries under a [{for_version}] heading first."
        )
    return match.group(1).strip()


def build(dest: pathlib.Path) -> pathlib.Path:
    missing = [name for name in PACKAGE if not (ROOT / name).exists()]
    if missing:
        raise SystemExit(f"error: cannot package, missing: {', '.join(missing)}")

    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in PACKAGE:
            info = zipfile.ZipInfo(name, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, (ROOT / name).read_bytes())
    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    zip_cmd = sub.add_parser("zip", help="build the extension ZIP")
    zip_cmd.add_argument("--out", type=pathlib.Path, default=None)

    notes_cmd = sub.add_parser("notes", help="print a version's CHANGELOG section")
    notes_cmd.add_argument("version", nargs="?", default=None)

    sub.add_parser("version", help="print the version in manifest.json")

    args = parser.parse_args()

    if args.command == "version":
        print(version())
        return 0

    if args.command == "notes":
        print(notes(args.version or version()))
        return 0

    out = args.out or ROOT / "dist" / f"meeting-burn-{version()}.zip"
    built = build(out)
    kb = built.stat().st_size / 1024
    try:
        shown = built.relative_to(ROOT)
    except ValueError:
        shown = built  # --out somewhere outside the repo
    print(f"  · {shown} — {len(PACKAGE)} files, {kb:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
