# AGENTS.md

Instructions for AI coding agents working in this repository. Humans are welcome to
read it too — but [CONTRIBUTING.md](CONTRIBUTING.md) is written for them and is the
friendlier door.

If anything here conflicts with an explicit instruction from the maintainer, the
maintainer wins. If anything here conflicts with `CONTRIBUTING.md`, that's a bug in
this file — fix it in the same PR.

---

## 1. What this project is

Meeting Burn is **three hand-written files served as-is**: `index.html`, `app.css`
and `app.js`. There is no framework, no bundler, no package manager, no lockfile, no
`node_modules`, and no backend. Nothing is generated; what is in the repo is what the
browser runs.

The same files are also a Manifest V3 Chrome extension — `manifest.json` points both
the toolbar popup and the side panel at `index.html`. There is no separate extension
build and no second copy of the app.

```
index.html              Markup
app.css                 Every style
app.js                  Every line of behaviour
manifest.json           Chrome extension manifest (MV3), at the repo root
icons/                  Extension icons (generated once, committed)
scripts/verify.py       The only check. Stock Python, no dependencies.
scripts/package.py      Builds the release ZIP; reads a version's changelog section
.github/workflows/      ci.yml (verify), pages.yml (demo), release.yml (tagged ZIP)
README.md               User-facing docs
CONTRIBUTING.md         Human contributor guide
CHANGELOG.md            Keep a Changelog format
```

### The hard rules

**1. Never add a dependency, a build step, or an external resource.** No CDN script,
no CDN stylesheet, no Google Font, no npm. Local relative `href`/`src` to a file in
this repo is the only kind allowed. `scripts/verify.py` enforces this and CI will
fail the PR.

There is exactly **one** network call in the app: the Google Calendar read, from
`app.js`, through the `CAL_ENDPOINT` constant. `verify.py` checks that it is the only
`fetch()`, that it lives in `app.js`, and that no other absolute URL appears in the
script. **Don't add a second one.** If a feature seems to need one, that is the
conversation to have first — the single call is what keeps the privacy section in the
README short enough to be worth reading.

**2. Never put script back inline in `index.html`.** Chrome's MV3 content security
policy blocks inline `<script>` and inline event handlers on extension pages, so an
inline block breaks the popup and the side panel while still looking fine on the web
demo. All behaviour goes in `app.js`; `verify.py` checks for this. Inline `<style>`
is not blocked, but keep styles in `app.css` anyway.

**3. Keep the file count small.** Three app files plus the manifest. A fourth
stylesheet or a second script is a design smell here — ask first.

If a task seems to require breaking one of these rules, **stop and ask** rather
than doing it.
Don't work around the check, don't add exclusions to `verify.py`, and don't relax the
size budget to make something fit. The constraint is the product.

---

## 2. Before you touch anything

```bash
python3 scripts/verify.py
```

This must pass before you start and after you finish. It takes under a second and
needs no setup. If it fails on a clean checkout, report that — don't "fix" it by
loosening the check.

To see the app running:

```bash
python3 -m http.server 4187    # then open http://localhost:4187
```

---

## 3. Branching

**Never commit to `main`.** It's a protected branch, but the maintainer's
admin account can *bypass* the rule rather than being blocked by it — meaning a
direct push silently succeeds and leaves a mess that can't be force-pushed away.
Always branch.

Name branches `<type>/<short-kebab-description>`:

```
feat/pause-resume
fix/counter-drift-on-resume
docs/clarify-hours-default
ci/pin-python-version
refactor/extract-rate-math
```

Start from an up-to-date `main`:

```bash
git switch main && git pull --ff-only
git switch -c feat/pause-resume
```

---

## 4. Commits

Short imperative subject line, under ~72 characters, no trailing period:

```
Add pause and resume to a running meeting
```

Not "Added…", not "Adds…", not "feat: add…" — this repo doesn't use Conventional
Commits in its own history (Dependabot's `ci:` prefix is its own convention, leave it
alone). If the change needs justification, add a blank line and a body explaining
**why**; the diff already shows what.

Agents must include their attribution trailer, separated by a blank line:

```
Co-Authored-By: <Agent Name> <noreply@example.com>
```

Don't amend or rebase commits that are already pushed to a shared branch.

---

## 5. Pull requests

Open a PR for everything. `main` requires a PR, a passing `Verify` check, and all
review conversations resolved.

**Open it automatically — don't wait to be asked.** As soon as a change is complete
and `scripts/verify.py` passes, branch, commit, push and open the PR as the final
step of the same task. "Complete" means the work is finished and verified, including
the `README.md` and `CHANGELOG.md` updates the checklist below requires; a
half-finished change stays uncommitted until it isn't. Report the PR link when you
are done. Two exceptions: work the maintainer explicitly asked you to leave
uncommitted, and a change you have flagged as needing a decision before it lands —
in those cases say so instead of opening one.

```bash
git push -u origin feat/pause-resume
gh pr create --fill   # then edit to match .github/PULL_REQUEST_TEMPLATE.md
```

Fill in the template honestly. The "How was it tested?" section must describe what
you actually did — **if you could not run the app in a browser, say so explicitly**
rather than implying manual testing you didn't perform.

Requirements before requesting review:

- `python3 scripts/verify.py` passes
- CI is green
- The PR does one thing; unrelated cleanups go in their own PR
- `README.md` is updated if behaviour, defaults or settings changed
- `CHANGELOG.md` has an entry under `## [Unreleased]` for anything user-visible

**Merging:** squash only (merge commits and rebase merges are disabled). The branch
is deleted automatically. Required approvals are set to **0** because the maintainer
works solo, so a PR can be self-merged once CI is green — but **an agent must never
merge its own PR without being asked to.** Open it, report the link, and stop.

---

## 6. Dependabot PRs

The app has no dependencies. Dependabot only watches the GitHub Actions used in CI,
monthly, with the `ci:` commit prefix and the `dependencies` label.

There are usually a handful open. Handle them like this:

**1. Check what actually changed.** These are major-version bumps of first-party
`actions/*`. Read the release notes before approving:

```bash
gh pr view <n> --repo rafael-zilberman/meeting-burn
gh pr diff <n>
```

**2. Verify CI passed on the PR branch.** This is the real signal — `ci.yml` uses
`actions/checkout` and `actions/setup-python`, so a bump to either is exercised by
its own run. A green `Verify` on `actions/checkout` v4→v7 means the new version
works here.

```bash
gh pr checks <n>
```

**3. `pages.yml` bumps are the risky ones.** `configure-pages`, `upload-pages-artifact`
and `deploy-pages` are *not* exercised by PR CI — `pages.yml` only runs on push to
`main`. A broken bump takes the live demo down and you won't know until after merge.
For these, check the action's changelog for breaking changes to inputs, and after
merging confirm the deploy succeeded:

```bash
gh run list --workflow pages.yml --limit 1
curl -s -o /dev/null -w '%{http_code}\n' https://rafael-zilberman.github.io/meeting-burn/
```

**4. Batching is fine.** If several bumps are all green and low-risk, say so in one
summary rather than opening five separate reports.

**5. Never merge a Dependabot PR unprompted.** Report the status and your
recommendation; let the maintainer decide. If asked to merge:

```bash
gh pr merge <n> --squash --delete-branch
```

**6. Don't edit a Dependabot branch.** If one needs changes, close it and open your
own PR; Dependabot will otherwise fight you on the next run.

If a bump genuinely breaks something, close the PR with a comment explaining why and
pin the working version in the workflow — don't leave it open and silent.

---

## 7. Code conventions

**Formatting** is set by `.editorconfig`: 2-space indent, LF endings, UTF-8, final
newline, no trailing whitespace. There is no formatter or linter; match the
surrounding code.

**CSS**
- Lives in `app.css`, organized into commented sections
  (`/* ─── tokens ─── */`, `/* ─── card ─── */`, …). Add to the right section.
- Colors, radii, easings and fonts are custom properties on `:root`. Use the tokens;
  don't hardcode a hex value that duplicates one.
- Any new animation must be covered by the existing
  `@media (prefers-reduced-motion: reduce)` block.
- Check narrow widths (~375px). The card has a `@media (max-width: 420px)` block.

**JavaScript**
- Lives in `app.js`: one IIFE, `"use strict"`, plain ES2020+. Loaded with
  `<script src="app.js" defer>`. No transpiling — only use syntax that
  current Chrome, Edge, Firefox and Safari support natively.
- Money is formatted through `Intl.NumberFormat` so the viewer's locale decides
  separators. Never hardcode a currency symbol or `toFixed(2)` for display.
- Elapsed time comes from `Date.now()` deltas, never from an accumulating counter.
  This is deliberate: it keeps the total correct when the tab is throttled or
  backgrounded. Don't "simplify" it into a `setInterval` tally.
- A meeting is a series of counted segments: `accumulated` banks the milliseconds
  from finished segments, `segmentAt` marks when the current one began, and
  `elapsedMs()` is the only thing that should read them. Pausing adds the live
  segment to `accumulated`; resuming resets `segmentAt`. Never subtract a "paused
  duration" after the fact — that's how drift gets in.
- Settings persist under the `mct.settings.v2` key. **If you change the shape or
  meaning of a stored field, bump the key version.** A stale value reinterpreted
  under new semantics silently corrupts every number the app shows — this already
  happened once when monthly salary replaced annual.
- `localStorage` access is wrapped in `try/catch` because it throws in some privacy
  modes. Keep it that way.

**The extension**
- `manifest.json` lives at the repo root so the popup and the side panel can load
  `index.html` and its two files directly. Don't move the app into a subdirectory.
- The manifest points at `index.html?surface=popup` and `index.html?surface=panel`.
  `app.js` reads that parameter and puts `ext` / `ext-popup` / `ext-panel` on
  `<html>`; `app.css` has one small section keyed off those classes. Loaded as a
  plain web page there is no parameter and none of it applies.
- The toolbar popup has no viewport of its own — Chrome sizes it to the document —
  so `html.ext-popup` pins a width and height. Changing the card's size means
  rechecking that number.
- Any `chrome.*` call must be guarded with `typeof chrome !== "undefined"`; the same
  code runs on the web demo where those APIs don't exist.
- The permissions are `sidePanel`, `identity`, `activeTab` and `scripting`, plus
  `host_permissions` for `googleapis.com`. `identity` and the host entry exist only for
  the connected calendar read; `activeTab` + `scripting` exist only for the fallback
  that reads an open Google Calendar tab. Don't add a content script, a service worker,
  or any further host permission without asking — each one changes what the extension
  can see and what the Web Store review asks for.
- The tab fallback injects `readCalendarPage` from `app.js` with
  `chrome.scripting.executeScript`. It is deliberately **not** a declared content
  script: `activeTab` grants one tab, only on a toolbar click, so the extension holds
  no standing access to any site and the repo keeps its three app files. That function
  runs in a page we don't control — keep it standalone (it can't see anything in
  `app.js`), and keep treating everything it returns as untrusted text: capped, clamped
  and written with `textContent`.
- It reads **only an open event dialog**. Scanning the grid for "the event happening
  now" was shipped once and reverted: a week view renders seven days of chips, nothing
  in a chip reliably identifies its day, and Google's labels carry the time twice in two
  formats. It confidently prefilled yesterday's out-of-office block. Don't re-add it
  without a signal that actually says which day a chip belongs to — a wrong headcount is
  worse than none, since it's the number this app exists to get right.
- The OAuth client ID in `manifest.json` is a placeholder on purpose; a real one
  belongs to whoever installs the extension. `app.js` treats a `REPLACE`-prefixed ID
  as "not configured" and keeps the feature off rather than failing. Don't commit a
  real client ID.
- Icons under `icons/` were generated once and committed. Replacing them is fine;
  adding a build step that generates them is not.

**Accessibility**
- Icon-only buttons need an `aria-label`; `verify.py` checks this.
- Keep the keyboard controls working: `Space` starts, then pauses/resumes; `Enter`
  ends the meeting; arrows adjust headcount; `Esc` closes settings.

---

## 8. Testing expectations

There is no test suite. `verify.py` catches structural and self-containment
regressions, not behavioural ones. For anything touching the cost math or the UI
flow, verify by hand and describe what you did:

- Start → run → stop, and confirm the total matches
  `people × (salary / hours / 3600) × seconds`
- Pause mid-meeting, wait, resume, then stop — the paused interval must not appear
  in either the cost or the duration
- Change currency and salary, reload, confirm persistence
- Keyboard controls
- ~375px and a wide viewport
- Reduced motion, if you touched an animation
- If you touched anything the extension uses — which is everything — load the folder
  unpacked at `chrome://extensions` and check both the popup and the side panel.
  `index.html?surface=popup` in a 384×592 window approximates the popup, but it is
  not the same thing: the real popup enforces the MV3 CSP and a plain page doesn't

An agent that cannot open a browser should say which of these it could not check.

---

## 9. Releases

**Every push to `main` publishes a release.** Merging a PR is therefore a publishing
action — one more reason an agent must never merge its own PR unasked (§10).

The version is derived, not hand-edited. `release.yml` takes MAJOR.MINOR from
`manifest.json` and uses the commit count on `main` as the patch, so `1.1.0` in the
repo ships as `1.1.42`. The count only ever increases, which is what the Chrome Web
Store requires of consecutive uploads, and it needs no state carried between runs.

**The patch digit committed in `manifest.json` is a placeholder.** CI overwrites it
with `package.py stamp` before packaging and does not commit the result — a commit
from CI would re-trigger the workflow. Don't try to keep that digit accurate by hand,
and don't read it as the released version; `git tag` is the record of what shipped.

To make a release **1.2.0 instead of 1.1.x**, bump MINOR in `manifest.json` in an
ordinary PR. The next push to `main` picks it up. That is the only manual step, and
it is the only reason to touch the version at all.

Release notes come from `CHANGELOG.md`: the section matching the version if one
exists, otherwise `## [Unreleased]`, with GitHub's generated commit list appended.
In practice `Unreleased` is the notes for every release, so **keep it current** —
it is now user-facing on each merge, not a staging area for some future version.
Its entries are the human-written summary the commit list can't give.

Running the workflow by hand (`workflow_dispatch`) builds the same ZIP as an
artifact and tags nothing. That is how to check packaging without publishing.

A re-run for a commit that already has its tag exits without republishing, so
re-running a failed job is safe.

**The ZIP serves both distribution paths**, which is why `package.py` has an
explicit file list rather than zipping the directory. It contains only what the
extension runs, with `manifest.json` at the archive root: unzip it and *Load
unpacked* works, and the same file uploads to the Chrome Web Store. Adding a file
the extension needs means adding it to `PACKAGE` in `package.py` — `verify.py`
imports that list and fails if an entry is missing, but it cannot tell you about a
file you forgot to list. Don't add documentation or CI config to the package.

Builds are deterministic: fixed entry order, fixed timestamps. The same commit
always produces a byte-identical archive. Keep it that way.

---

## 10. Scope boundaries

**In scope:** meeting history, cost breakdowns, sharing, currencies, accessibility,
performance, docs, the extension surfaces, release packaging, and the existing
read-only calendar prefill.

**Out of scope — don't build these, propose them first:** accounts, a backend,
analytics or telemetry of any kind, anything that sends data off the device *other
than the one calendar read*, a second network call of any kind, and anything that
needs a build step or grows the file count (see the hard rules in §1).

**Never do without being asked:** merge a PR, push to `main`, create a release or
tag by hand, change repository settings or branch protection, force-push anything,
or alter `LICENSE`. The first two now publish a release as a side effect (§9), so
they are not reversible in the way they used to be.
