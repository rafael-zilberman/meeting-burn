#!/usr/bin/env python3
"""Guard the promises Meeting Burn makes in its README.

Runs in CI and locally with no dependencies:

    python3 scripts/verify.py

Checks that index.html is well-formed, self-contained (no external scripts,
stylesheets, fonts or network calls), and small enough to stay a single file.
"""

from __future__ import annotations

import html.parser
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "index.html"

# A single file people download over a hotel wifi. Keep it honest.
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
        (r'<script[^>]+\ssrc\s*=', "an external <script src=...>"),
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


def check_size(src: str) -> None:
    kb = len(src.encode("utf-8")) / 1024
    if kb > SIZE_BUDGET_KB:
        fail(f"index.html is {kb:.0f} KB, over the {SIZE_BUDGET_KB} KB budget")
    else:
        notes.append(f"size {kb:.0f} KB of {SIZE_BUDGET_KB} KB budget")


def check_accessibility(src: str) -> None:
    """Cheap checks for the things that actually break screen readers here."""
    for match in re.finditer(r'<button\b[^>]*>(.*?)</button>', src, re.S | re.I):
        tag, inner = match.group(0), match.group(1)
        text = re.sub(r"<[^>]+>", "", inner).strip()
        if not text and "aria-label" not in tag:
            line = src.count("\n", 0, match.start()) + 1
            fail(f"line {line}: icon-only <button> needs an aria-label")

    if "prefers-reduced-motion" not in src:
        fail("the reduced-motion media query is gone — animation must stay opt-out")


def main() -> int:
    if not APP.exists():
        print("error: index.html not found", file=sys.stderr)
        return 1

    src = APP.read_text(encoding="utf-8")
    check_structure(src)
    check_self_contained(src)
    check_size(src)
    check_accessibility(src)

    for note in notes:
        print(f"  · {note}")

    if failures:
        print(f"\n✗ {len(failures)} problem(s) found:\n", file=sys.stderr)
        for problem in failures:
            print(f"  - {problem}", file=sys.stderr)
        print(file=sys.stderr)
        return 1

    print("\n✓ index.html is well-formed, self-contained and within budget")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
