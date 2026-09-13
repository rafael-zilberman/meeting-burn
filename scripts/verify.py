#!/usr/bin/env python3
"""Guard the promises Meeting Burn makes in its README.

Runs in CI and locally with no dependencies:

    python3 scripts/verify.py

Checks that index.html is well-formed, that the app is self-contained (every
script and stylesheet is a local file — no CDN, no font service, no network
calls at runtime), that it stays small, and that the Chrome extension manifest
still points at files that exist.
"""

from __future__ import annotations

import html.parser
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "index.html"
STYLES = ROOT / "app.css"
SCRIPT = ROOT / "app.js"
MANIFEST = ROOT / "manifest.json"

# The whole app, downloaded over a hotel wifi. Keep it honest.
SIZE_BUDGET_KB = 150

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
        (r'\bfetch\s*\(', "a fetch() call"),
        (r'\bXMLHttpRequest\b', "an XMLHttpRequest"),
        (r'\bnew\s+WebSocket\b', "a WebSocket"),
        (r'\bnavigator\.sendBeacon\b', "a sendBeacon call"),
    ]
    for pattern, description in offenders:
        for match in re.finditer(pattern, src, re.IGNORECASE):
            line = src.count("\n", 0, match.start()) + 1
            fail(f"line {line}: found {description} — the app must stay self-contained")


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
