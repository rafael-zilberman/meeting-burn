# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Chrome extension.** The app now installs as a Manifest V3 extension with two
  surfaces: a toolbar popup and a side panel that stays open beside the meeting tab.
  Both load the same `index.html` and share the same settings. Chrome 114+, loaded
  unpacked; `sidePanel` is the only permission.
- A side-panel button in the popup header, shown only when running as an extension.

### Changed

- The app is now three files — `index.html`, `app.css`, `app.js` — instead of one.
  No build step and no dependencies were added; the CSS and JS simply moved out of
  `index.html`, because Chrome's extension CSP blocks inline `<script>`. The web
  demo behaves exactly as before.
- `scripts/verify.py` checks all three files, validates `manifest.json` paths, and
  fails if an inline `<script>` reappears in `index.html`.

Ideas on the table: pause/resume, meeting history, a weekly total.

## [1.0.0] — 2026-09-12

First public release.

### Added

- Live cost counter that updates continuously while a meeting runs, derived from
  wall-clock timestamps so it stays accurate when the tab is throttled.
- Headcount stepper with a dot-per-person visual and a per-minute burn preview.
- Summary screen with total cost, duration, cost per person, and a copyable
  one-line summary.
- Settings sheet for median monthly salary, currency, and working hours per month,
  persisted to `localStorage`.
- Nine currencies (ILS, USD, EUR, GBP, CAD, AUD, INR, JPY, BRL), formatted through
  `Intl.NumberFormat` so separators follow the viewer's locale.
- Keyboard controls: `Space` to start and stop, arrow keys for headcount, `Esc` to
  close settings.
- `prefers-reduced-motion` support throughout.

[Unreleased]: https://github.com/rafael-zilberman/meeting-burn/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rafael-zilberman/meeting-burn/releases/tag/v1.0.0
