# Meeting Burn

**Watch your meeting burn money in real time.**

Set how many people are in the room, hit start, and a live counter ticks upward for
every second the meeting runs. Stop it and you get the damage — total, per person,
and a comment you probably deserved.

[![CI](https://github.com/rafael-zilberman/meeting-burn/actions/workflows/ci.yml/badge.svg)](https://github.com/rafael-zilberman/meeting-burn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](#)

🔗 **[Live demo](https://rafael-zilberman.github.io/meeting-burn/)**

---

## Why

Meetings feel free. They aren't. A one-hour sync with eight people isn't an hour —
it's a full working day of payroll, spent on talking. This makes that visible while
it's still happening, which is the only moment the information is useful.

## Features

- **Live counter** — the cost updates continuously, not once per second.
- **Pause and resume** — step out, take the call, come back. Paused time isn't
  billed, and the total only ever counts the minutes the meeting was actually
  running.
- **Configurable rate** — median *monthly* salary and working hours per month.
- **9 currencies** — ILS, USD, EUR, GBP, CAD, AUD, INR, JPY, BRL. Amounts are
  formatted with `Intl.NumberFormat`, so separators follow the viewer's locale.
- **Summary** — duration, headcount, cost per person, and a copyable one-liner
  for pasting into Slack.
- **Settings persist** in `localStorage`. Set it once.
- **Keyboard-driven** — `Space` starts the meeting and then pauses/resumes it,
  `Enter` ends it, `↑ ↓` adjust headcount, `Esc` closes settings.
- **Chrome extension** — the same app as a toolbar popup and a side panel, so the
  counter stays visible next to your call.
- **Zero dependencies.** Three files, no build step, no npm install, no tracking,
  no network calls of any kind.

## Usage

Use the [live demo](https://rafael-zilberman.github.io/meeting-burn/), or clone the
repo and open `index.html` in a browser — there is nothing to install and nothing to
compile.

To run it from a local server instead:

```bash
git clone git@github.com:rafael-zilberman/meeting-burn.git && cd meeting-burn && python3 -m http.server 4187
```

Then open <http://localhost:4187>.

## Install as a Chrome extension

The repository is also a Manifest V3 extension. It isn't on the Web Store yet, so
load it unpacked:

1. Download `meeting-burn-<version>.zip` from the
   [latest release](https://github.com/rafael-zilberman/meeting-burn/releases/latest)
   and unzip it — or just clone the repo, which works the same way.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder (the one with
   `manifest.json` in it).

You then get two ways to run it:

- **Popup** — click the Meeting Burn icon in the toolbar. Quick to open; it closes
  when you click elsewhere, which is fine because the running meeting is saved and
  restored — elapsed time comes from wall-clock timestamps, not from the popup being
  alive, so the counter keeps moving while it's shut.
- **Side panel** — open Chrome's side panel and pick *Meeting Burn*, or click the
  panel button in the popup's header. This is the one to use during a call: it stays
  open beside the meeting tab so the counter is visible the whole time.

Both surfaces load the same `index.html`, and settings *and the meeting in progress*
are shared between them — start in the popup, carry on in the side panel.
Requires Chrome 114+ (for the side panel). The extension asks for the `sidePanel`
permission and nothing else — no host permissions, no access to any page you visit.

## Project structure

```
index.html       Markup
app.css          Every style
app.js           Every line of behaviour
manifest.json    Chrome extension manifest (MV3)
icons/           Extension icons
scripts/         verify.py (the checks) and package.py (the release ZIP)
```

## How the cost is calculated

```
costPerPersonPerSecond = monthlySalary / workingHoursPerMonth / 3600
totalCost              = costPerPersonPerSecond × people × countedSeconds
```

`countedSeconds` is time the meeting was actually running — pauses are excluded, so
the duration on the summary screen is billable time, not wall-clock time.

Defaults are **₪20,000/month** across **182 hours** (the standard Israeli work
month) for **5 people** — about **₪9.16 per minute**.

Two notes on accuracy:

- **Use fully-loaded cost, not take-home salary.** Benefits, taxes, equipment and
  overhead typically add 25–50% on top of gross pay. If you enter a raw salary, the
  number you see is an underestimate.
- **Elapsed time comes from wall-clock timestamps**, not an accumulating counter, so
  the total stays correct even if the tab is backgrounded or throttled. Pausing banks
  the current segment and stops the clock; resuming starts a new one.

## Configuration

Open the ⚙︎ settings sheet to change:

| Setting | Default | Notes |
| --- | --- | --- |
| Median monthly salary | ₪20,000 | Quick-pick chips adapt to the chosen currency |
| Currency | ILS | Drives formatting everywhere in the app |
| Working hours per month | 182 | Use ~173 for a 40-hour week |

Settings are stored under the `mct.settings.v2` key in `localStorage`, and the
meeting in progress under `mct.session.v1`. Neither ever leaves the browser.

## Browser support

Any current version of Chrome, Edge, Firefox, or Safari; the extension needs Chrome
114+ for its side panel. The design leans on `backdrop-filter` and CSS gradient
masks; in a browser without them the layout still works, it just looks flatter. `prefers-reduced-motion` is respected — the animated
background and all transitions are disabled.

## Releases

Each release ships a `meeting-burn-<version>.zip` containing only what the extension
runs — the four app files, the icons and the licence, with `manifest.json` at the
archive root. That is both the folder you load unpacked and the package the Chrome
Web Store accepts.

Build it yourself at any commit:

```bash
python3 scripts/package.py zip
```

Releases are automatic: every push to `main` tags and publishes one. The version is
`MAJOR.MINOR` from `manifest.json` with the commit count as the patch, so the
released version always moves forward. Bump the minor in `manifest.json` when a
release deserves it — that's the only manual step. Notes come from the `Unreleased`
section of the changelog, with the commit list appended.

## Contributing

Issues and pull requests are welcome. The whole app is three short files, so changes
are easy to read and easy to review. Please keep it that way: **no build step and no
runtime dependencies** — CI enforces it.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then:

```bash
python3 scripts/verify.py   # the same check CI runs
```

## Project docs

- [Contributing guide](CONTRIBUTING.md) — setup, the one hard rule, how to test
- [AGENTS.md](AGENTS.md) — conventions and workflow for AI coding agents
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md) — how to report a vulnerability privately
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 Rafael Zilberman
