#!/usr/bin/env python3
"""Guard the promises Meeting Burn makes in its README.

Runs in CI and locally with no dependencies:

    python3 scripts/verify.py

Checks that index.html is well-formed, that the app is self-contained (every
script and stylesheet is a local file — no CDN, no font service), that the one
network call it is allowed to make still goes where it claims to, that it stays
small, that the Chrome extension manifest still points at files that exist, and
that the extension is packageable.
"""

from __future__ import annotations

import html.parser
import json
import pathlib
import re
import sys

import package

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "index.html"
STYLES = ROOT / "app.css"
SCRIPT = ROOT / "app.js"
MANIFEST = ROOT / "manifest.json"

# The whole app, downloaded over a hotel wifi. Keep it honest.
SIZE_BUDGET_KB = 150

# The single network call the app is allowed to make: reading the events that are
# on your calendar right now, from the extension, after you connect it. This is a
# guard, not an exemption — a second call, a call from another file, or a call to
# any other host still fails. See "Privacy" in README.md.
CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3/"
NETWORK_FILE = "app.js"
ENDPOINT_CONST = "CAL_ENDPOINT"

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

failures: list[str] = []
notes: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


class Balance(html.parser.HTMLParser):
    """Minimal well-formedness check: every non-void tag gets closed, in order."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []

    def handle_starttag(self, tag: str, attrs: object) -> None:
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID:
            return
        if not self.stack:
            fail(f"stray closing </{tag}> at line {self.getpos()[0]}")
            return
        open_tag, line = self.stack.pop()
        if open_tag != tag:
            fail(
                f"mismatched tag: <{open_tag}> opened at line {line} "
                f"but </{tag}> closed at line {self.getpos()[0]}"
            )


def check_structure(src: str) -> None:
    parser = Balance()
    parser.feed(src)
    parser.close()
    for tag, line in parser.stack:
        fail(f"unclosed <{tag}> opened at line {line}")

    for required in ("<!DOCTYPE html>", "<title>", 'lang="', 'name="viewport"'):
        if required.lower() not in src.lower():
            fail(f"index.html is missing {required}")


def check_self_contained(src: str) -> None:
    """No external resources. This is the whole point of the project."""
    offenders = [
        (r'<script[^>]+\ssrc\s*=\s*["\'](?:https?:|//)', "an external <script src=...>"),
        (r'<link[^>]+href\s*=\s*["\']https?:', "an external stylesheet or font"),
        (r'@import\s+url\(', "a CSS @import"),
        (r'\bXMLHttpRequest\b', "an XMLHttpRequest"),
        (r'\bnew\s+WebSocket\b', "a WebSocket"),
        (r'\bnavigator\.sendBeacon\b', "a sendBeacon call"),
    ]
    for pattern, description in offenders:
        for match in re.finditer(pattern, src, re.IGNORECASE):
            line = src.count("\n", 0, match.start()) + 1
            fail(f"line {line}: found {description} — the app must stay self-contained")


def check_network(parts: dict[str, str]) -> None:
    """Exactly one fetch(), in one file, to one endpoint.

    The app used to make no network calls at all. It now makes one, so the check
    changed from "none" to "that one and nothing else" rather than being dropped:
    a fetch anywhere else, a second fetch, or a stray absolute URL in the script
    all still fail the build.
    """
    calls = [
        (name, src.count("\n", 0, match.start()) + 1, match.group(1))
        for name, src in parts.items()
        for match in re.finditer(r"\bfetch\s*\(([^)]*)", src)
    ]
    for name, line, args in calls:
        if name != NETWORK_FILE:
            fail(f"{name} line {line}: fetch() is only allowed in {NETWORK_FILE}")
        elif ENDPOINT_CONST not in args:
            fail(
                f"{name} line {line}: fetch() must go through {ENDPOINT_CONST} — "
                "the calendar read is the only network call this app may make"
            )
    if len(calls) > 1:
        fail(f"{len(calls)} fetch() calls; the calendar read is meant to be the only one")

    script = parts[NETWORK_FILE]
    for match in re.finditer(r"""["'](https?://[^"']*)["']""", script):
        url = match.group(1)
        if not url.startswith(CALENDAR_ENDPOINT):
            line = script.count("\n", 0, match.start()) + 1
            fail(f"{NETWORK_FILE} line {line}: {url} is not {CALENDAR_ENDPOINT}")

    if calls:
        notes.append("one network call, to the calendar read")


def check_size(parts: dict[str, str]) -> None:
    kb = sum(len(src.encode("utf-8")) for src in parts.values()) / 1024
    if kb > SIZE_BUDGET_KB:
        fail(f"the app is {kb:.0f} KB, over the {SIZE_BUDGET_KB} KB budget")
    else:
        notes.append(f"size {kb:.0f} KB of {SIZE_BUDGET_KB} KB budget")


def check_local_assets(src: str) -> None:
    """Every script and stylesheet index.html pulls in must be a file we ship."""
    refs = re.findall(r'<script[^>]+\ssrc\s*=\s*["\']([^"\']+)', src, re.I)
    refs += re.findall(r'<link[^>]+href\s*=\s*["\']([^"\']+)', src, re.I)
    for ref in refs:
        if ref.startswith(("http:", "https:", "//", "data:")):
            continue
        if not (ROOT / ref.split("?")[0]).exists():
            fail(f"index.html references {ref}, which does not exist")


def check_manifest(src: str) -> None:
    """The extension loads the same index.html; keep its paths honest."""
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"manifest.json is missing or not valid JSON: {exc}")
        return

    if manifest.get("manifest_version") != 3:
        fail("manifest.json must stay on manifest_version 3")

    paths = [
        manifest.get("action", {}).get("default_popup"),
        manifest.get("side_panel", {}).get("default_path"),
    ]
    paths += list(manifest.get("icons", {}).values())
    paths += list(manifest.get("action", {}).get("default_icon", {}).values())
    for path in paths:
        if not path:
            fail("manifest.json is missing a popup or side panel path")
        elif not (ROOT / path.split("?")[0]).exists():
            fail(f"manifest.json points at {path}, which does not exist")

    # Extension pages forbid inline script; index.html must keep loading app.js
    # from a file rather than growing a <script> block back.
    if re.search(r"<script(?![^>]*\ssrc)", src, re.I):
        fail("index.html has an inline <script> — Chrome's MV3 CSP blocks it")


def check_packaging() -> None:
    """Everything `package.py zip` ships must exist, and the ZIP must be uploadable.

    The Chrome Web Store rejects a package for small, boring reasons — a version it
    can't parse, a description over the limit, a missing 128px icon. Catching those
    here means a release fails on a PR rather than at upload time.
    """
    for name in package.PACKAGE:
        if not (ROOT / name).exists():
            fail(f"package.py ships {name}, which does not exist")

    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return  # already reported by check_manifest

    version = manifest.get("version", "")
    if not re.fullmatch(r"\d+(\.\d+){0,3}", str(version)):
        fail(f"manifest version {version!r} is not one to four dot-separated integers")

    description = manifest.get("description", "")
    if not description:
        fail("manifest.json needs a description — the Web Store listing requires one")
    elif len(description) > 132:
        fail(f"manifest description is {len(description)} chars, over the Web Store's 132")

    if "128" not in manifest.get("icons", {}):
        fail("manifest.json needs a 128px icon for the Web Store")

    if "manifest.json" not in package.PACKAGE:
        fail("the ZIP must contain manifest.json at its root")

    notes.append(f"packages {len(package.PACKAGE)} files as version {version}")


def check_accessibility(src: str, styles: str) -> None:
    """Cheap checks for the things that actually break screen readers here."""
    for match in re.finditer(r'<button\b[^>]*>(.*?)</button>', src, re.S | re.I):
        tag, inner = match.group(0), match.group(1)
        text = re.sub(r"<[^>]+>", "", inner).strip()
        if not text and "aria-label" not in tag:
            line = src.count("\n", 0, match.start()) + 1
            fail(f"line {line}: icon-only <button> needs an aria-label")

    if "prefers-reduced-motion" not in styles:
        fail("the reduced-motion media query is gone — animation must stay opt-out")


def main() -> int:
    missing = [p.name for p in (APP, STYLES, SCRIPT, MANIFEST) if not p.exists()]
    if missing:
        print(f"error: {', '.join(missing)} not found", file=sys.stderr)
        return 1

    parts = {p.name: p.read_text(encoding="utf-8") for p in (APP, STYLES, SCRIPT)}
    src = parts["index.html"]

    check_structure(src)
    for text in parts.values():
        check_self_contained(text)
    check_local_assets(src)
    check_manifest(src)
    check_network(parts)
    check_packaging()
    check_size(parts)
    check_accessibility(src, parts["app.css"])

    for note in notes:
        print(f"  · {note}")

    if failures:
        print(f"\n✗ {len(failures)} problem(s) found:\n", file=sys.stderr)
        for problem in failures:
            print(f"  - {problem}", file=sys.stderr)
        print(file=sys.stderr)
        return 1

    print("\n✓ the app is well-formed, self-contained and within budget")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
