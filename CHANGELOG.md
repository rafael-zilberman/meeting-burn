# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Google Calendar prefill.** Connect a calendar in the extension's settings and the
  setup screen fills in the headcount from everyone invited who hasn't declined, and
  the meeting's name from the event. It asks your calendar rather than your tabs, so
  it works for a meeting in a room as well as a video call. Meeting rooms are excluded
  from the count — a room accepts invitations but draws no salary. Overlapping
  invitations are offered newest-accepted-first and the chip cycles through the rest;
  all-day entries and meetings you declined are skipped.
- The event's name rides through the meeting — shown above the running counter, and
  written onto the history entry when it ends, where the summary screen still renames
  it. A prefilled headcount applies to that meeting only and never overwrites your
  default.
- **A fallback that needs no account.** With nothing connected, open an event on a
  Google Calendar tab and click the toolbar icon: its name and guest count are read
  straight off the page. It also covers events on calendars other than your primary one,
  which the API read doesn't ask about. This uses `activeTab`, so the extension holds no
  standing access to any site, runs no content script, and makes no network call; it's a
  popup feature, since the side panel gets no such grant.

### Fixed

- **A meeting where nobody had clicked *Yes* got no headcount at all.** Both reads
  counted only *accepted* attendees and ignored anything below two, so a two-person
  meeting whose guest had not responded came back empty. The rule is now everyone
  invited except the declines — a *maybe* and a silent guest both still turn up — and
  the chip reads "N going".
- **The calendar-tab fallback could prefill an event from the wrong day.** In a week
  view it scanned every event chip on screen and matched on the time of day alone, with
  no notion of which day a chip belonged to — so yesterday's 11am block was offered as
  today's meeting, with its name mangled by a time the label carried twice in two
  formats. The grid scan is gone: the fallback now reads only an event you have opened.
- Calendar prefill is **off until you turn it on**, read-only, and extension-only; the
  web demo has no way to do OAuth and never tries. The repo ships no OAuth client ID —
  see "Google Calendar" in the README for the ten-minute setup.

### Changed

- **The app now makes one network call.** It previously made none, and the README said
  so. Connecting a calendar calls `googleapis.com` and nothing else: `verify.py` now
  enforces "exactly one `fetch()`, in `app.js`, through `CAL_ENDPOINT`, and no other
  absolute URL in the script" rather than banning `fetch()` outright. The API reply is
  reduced to a title, a start time and a count before anything is cached — attendee
  names and addresses are counted and discarded. See "Privacy" in the README.
- The extension now asks for `identity`, `activeTab`, `scripting` and `googleapis.com`
  alongside `sidePanel`. The first and last are used only by the connected calendar
  read; `activeTab` and `scripting` only by the open-tab fallback.

- **Meeting history.** Ending a meeting files it away, and the summary screen now has
  a *Name this meeting* field that renames the entry as you type. A ⏱ button in the
  header opens the list — newest first, with the cost, duration, headcount and end
  time of each meeting, a per-row delete and a two-tap *Clear all*. The last 50 are
  kept, under the `mct.history.v1` key in `localStorage`.
- Each entry freezes the cost and the currency it was recorded in, so changing the
  salary or the currency later never rewrites a past meeting. The list totals each
  currency on its own rather than adding them together.
- The copied summary now leads with the meeting's name, when it has one.
- Pause and resume a running meeting. Paused time is excluded from the cost and
  from the duration shown on the summary, so the total reflects billable time only.
  The counter dims and the indicator turns amber while paused.
- **Chrome extension.** The app now installs as a Manifest V3 extension with two
  surfaces: a toolbar popup and a side panel that stays open beside the meeting tab.
  Both load the same `index.html` and share the same settings. Chrome 114+, loaded
  unpacked; `sidePanel` is the only permission.
- A side-panel button in the popup header, shown only when running as an extension.
- `scripts/package.py`, which builds `dist/meeting-burn-<version>.zip` — only the
  files the extension runs, with `manifest.json` at the archive root, so the same
  ZIP serves both *Load unpacked* and a Chrome Web Store upload. Builds are
  byte-reproducible.
- A `Release` workflow: every push to `main` verifies the app, builds the ZIP, tags
  and publishes a GitHub Release. The version is `MAJOR.MINOR` from `manifest.json`
  with the commit count as the patch, so it always moves forward; bump the minor by
  hand when a release deserves it. Notes come from this `Unreleased` section with
  the commit list appended. Running the workflow by hand builds the ZIP as an
  artifact and publishes nothing.

### Changed

- `Esc` now backs out of the history list as well as closing the settings sheet.
- The card scrolls instead of clipping when a viewport is too short to hold a view —
  the summary grew by a field, and a small window or the fixed-height popup could
  otherwise cut off its last button.
- `Space` now pauses and resumes a running meeting instead of ending it. `Enter`
  ends the meeting. `Space` still starts one from the setup screen.
- The app is now three files — `index.html`, `app.css`, `app.js` — instead of one.
  No build step and no dependencies were added; the CSS and JS simply moved out of
  `index.html`, because Chrome's extension CSP blocks inline `<script>`. The web
  demo behaves exactly as before.
- `scripts/verify.py` checks all three files, validates `manifest.json` paths, and
  fails if an inline `<script>` reappears in `index.html`.

### Fixed

- A meeting no longer resets when the popup closes. Chrome tears the popup down
  every time it loses focus; the running meeting is now persisted and restored, so
  reopening picks up where you left off. A running clock keeps counting while the
  popup is shut, a paused one stays paused, and the summary screen survives too.
  Because the popup and the side panel share an origin, a meeting started in one
  now continues in the other.

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
