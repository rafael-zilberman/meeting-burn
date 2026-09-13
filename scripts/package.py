#!/usr/bin/env python3
"""Build the distributable Chrome extension ZIP, and the version it ships under.

Stock Python, no dependencies, same as everything else here:

    python3 scripts/package.py zip              # -> dist/meeting-burn-<version>.zip
    python3 scripts/package.py version          # the version in manifest.json
    python3 scripts/package.py release-version  # the version CI will publish
    python3 scripts/package.py stamp 1.1.42     # write that version into manifest.json
    python3 scripts/package.py notes            # the release notes body

Every push to `main` publishes a release, so the patch digit is derived rather than
hand-edited: `release-version` takes MAJOR.MINOR from manifest.json and uses the
commit count on the current branch as the patch. That count only ever goes up, which
is what the Chrome Web Store requires of consecutive uploads, and it needs no state
carried between runs. **The patch digit committed in manifest.json is a placeholder**
— CI overwrites it with `stamp` before packaging. Bump MAJOR or MINOR by hand when a
release deserves it.

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
import subprocess
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


def section(heading: str) -> str | None:
    """The body of one `## [heading]` section of CHANGELOG.md, without its heading."""
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    pattern = rf"^## \[{re.escape(heading)}\][^\n]*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, changelog, re.S | re.M)
    return match.group(1).strip() if match else None


def notes(for_version: str) -> str:
    """Release notes: that version's changelog section, else Unreleased.

    Auto-published versions have no section of their own, so Unreleased is the
    normal path — it is where the human-written summary of what has landed lives.
    CI appends GitHub's generated commit list after this.
    """
    return section(for_version) or section("Unreleased") or ""


def commit_count() -> int:
    result = subprocess.run(
        ["git", "rev-list", "--count", "HEAD"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"error: cannot count commits: {result.stderr.strip()}")
    return int(result.stdout.strip())


def release_version() -> str:
    """MAJOR.MINOR from manifest.json, patch from the commit count."""
    parts = version().split(".")
    if len(parts) < 2:
        raise SystemExit(f"error: manifest version {version()!r} has no minor digit")
    return f"{parts[0]}.{parts[1]}.{commit_count()}"


def stamp(new_version: str) -> None:
    """Write a version into manifest.json, preserving formatting."""
    path = ROOT / "manifest.json"
    text = path.read_text(encoding="utf-8")
    stamped, count = re.subn(
        r'("version"\s*:\s*)"[^"]*"', rf'\1"{new_version}"', text, count=1
    )
    if count != 1:
        raise SystemExit("error: could not find \"version\" in manifest.json")
    path.write_text(stamped, encoding="utf-8")


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

    notes_cmd = sub.add_parser("notes", help="print the release notes body")
    notes_cmd.add_argument("version", nargs="?", default=None)

    sub.add_parser("version", help="print the version in manifest.json")
    sub.add_parser("release-version", help="print the version CI will publish")

    stamp_cmd = sub.add_parser("stamp", help="write a version into manifest.json")
    stamp_cmd.add_argument("version")

    args = parser.parse_args()

    if args.command == "version":
        print(version())
        return 0

    if args.command == "release-version":
        print(release_version())
        return 0

    if args.command == "stamp":
        stamp(args.version)
        print(f"  · manifest.json version is now {args.version}")
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
