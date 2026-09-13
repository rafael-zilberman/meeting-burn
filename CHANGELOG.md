# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Pause and resume a running meeting. Paused time is excluded from the cost and
  from the duration shown on the summary, so the total reflects billable time only.
  The counter dims and the indicator turns amber while paused.

### Changed

- `Space` now pauses and resumes a running meeting instead of ending it. `Enter`
  ends the meeting. `Space` still starts one from the setup screen.

Ideas still on the table: meeting history, a weekly total.

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
