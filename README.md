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
- **Meeting history** — name the meeting on the summary screen and it's kept, with
  its cost, duration, headcount and the time it ended. The last 50 are listed behind
  the ⏱ button in the header; delete one or clear the lot.
- **Settings persist** in `localStorage`. Set it once.
- **Keyboard-driven** — `Space` starts the meeting and then pauses/resumes it,
  `Enter` ends it, `↑ ↓` adjust headcount, `Esc` closes settings and backs out of
  history.
- **Chrome extension** — the same app as a toolbar popup and a side panel, so the
  counter stays visible next to your call.
- **Calendar prefill** — connect Google Calendar and the extension fills in the
  headcount from the people who *accepted*, and the meeting's name from the invite.
  Works for meetings in a room, not just video calls. Off by default, read-only, and
  the one thing in the app that touches the network — see [Privacy](#privacy).
- **Zero dependencies.** Three files, no build step, no npm install, no tracking,
  and exactly one network call — the calendar read, only if you connect one.

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
Requires Chrome 114+ (for the side panel). The extension asks for `sidePanel`,
`identity` and access to `googleapis.com` — the last two only get used if you connect
a calendar, and neither gives it access to any page you visit.

## Google Calendar

Meeting Burn can read which event you're in right now and fill in the two things it
would otherwise ask you to type: **how many people accepted**, and **what the meeting
is called**. It works for a meeting in a room as well as a video call, because it
asks your calendar rather than looking at your tabs.

It is **off until you turn it on** (⚙︎ → *Connect Google Calendar*), it is
**read-only**, and it is **extension-only** — the web demo has no way to do OAuth and
never tries.

What it does with what it reads:

- The headcount is the number of attendees whose response is *accepted*, **excluding
  meeting rooms** — a room accepts invitations too, and a room draws no salary.
- If several events overlap, the one you accepted wins, then the shorter one. Tap the
  chip to cycle through the others.
- All-day entries and meetings you declined are ignored.
- The prefilled headcount applies to that meeting only. It never overwrites the
  default you set with the `+`/`−` buttons.

### Setting up an OAuth client

The repo ships **no client ID** — an OAuth client belongs to whoever installs the
extension, so you make your own. It takes about ten minutes:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project
   and enable the **Google Calendar API**.
2. Configure the OAuth consent screen. Add the scope
   `https://www.googleapis.com/auth/calendar.events.readonly` and add yourself (and
   anyone else who'll use it) as a test user.
3. Load the extension unpacked and copy its ID from `chrome://extensions`. To keep
   that ID stable — and matching a Web Store build — add your extension's `key` to
   `manifest.json`.
4. Create an OAuth client of type **Chrome Extension**, using that ID.
5. Put the client ID into `manifest.json` under `oauth2.client_id`, replacing
   `REPLACE_WITH_YOUR_CLIENT_ID...`, and reload the extension.

Until you do, the settings sheet says so and the feature stays quietly off.

`calendar.events.readonly` is a *sensitive* scope, so an unverified client is capped
at 100 users and shows Google's "unverified app" screen. That is fine for yourself and
your team. Publishing this on the Web Store for strangers means going through Google's
verification — a privacy policy URL, a verified domain and a demo video.

If you'd rather revoke access later, the *Disconnect* button drops the token Chrome
cached; removing the grant itself is done at
[your Google account permissions](https://myaccount.google.com/permissions).

## Privacy

The app has no backend, no analytics and no accounts. Settings, the meeting in
progress and your history live in `localStorage` and are never sent anywhere.

The one exception is the calendar read, and only once you connect it:

- It calls `https://www.googleapis.com/calendar/v3/calendars/primary/events` and
  nothing else. `scripts/verify.py` enforces that — a second network call, or a call
  anywhere else, fails CI.
- It asks only for events in the next five minutes, only while the app is open. There
  is no background process and nothing polls.
- The reply is reduced to a **title, a start time and a count** before anything is
  stored. Attendee names, email addresses, descriptions and conference links are
  counted and discarded — they never reach disk.
- That reduced result is cached for 60 seconds under `mct.calendar.v1` so reopening
  the popup doesn't ask again. *Disconnect* deletes it.
- Nothing is sent to the author of this app, or to anyone but Google.

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

Settings are stored under the `mct.settings.v2` key in `localStorage`, the meeting
in progress under `mct.session.v1`, past meetings under `mct.history.v1`, and the
60-second calendar cache under `mct.calendar.v1`. None of it ever leaves the browser.

## Meeting history

Ending a meeting files it away. The summary screen has a **Name this meeting** field —
type into it and the entry is renamed as you go; leave it blank and it's listed as
*Untitled meeting*. The ⏱ button in the header opens the list, newest first.

Each entry keeps the cost, duration, headcount and end time **as they were when the
meeting ended**, in the currency that was set at the time. Changing your salary or
currency later re-prices the next meeting, never a past one — which is also why the
list totals each currency separately instead of adding them together.

The last 50 meetings are kept; older ones fall off the end. Delete a single entry
with the 🗑 button on its row, or **Clear all** to empty the list — that one takes
two taps, because there is no undo.

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
