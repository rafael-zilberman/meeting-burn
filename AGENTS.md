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
no CDN stylesheet, no Google Font, no `fetch()`, no npm. Local relative `href`/`src`
to a file in this repo is the only kind allowed. `scripts/verify.py` enforces this
and CI will fail the PR.

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
- `sidePanel` is the only permission. Don't add host permissions, a content script,
  or a service worker without asking — each one changes what the extension can see
  and what the Web Store review asks for.
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

Releases are **manual and maintainer-initiated**. Nothing in CI bumps a version or
creates a tag, and an agent must never do either without being asked — see §10.

When you *are* asked to prepare one, the steps are:

1. Bump `"version"` in `manifest.json`. Chrome wants one to four dot-separated
   integers; this repo uses semver.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] — YYYY-MM-DD` and add
   a fresh empty `Unreleased` above it. Update the link definitions at the bottom.
3. Open a PR with just that. Let it merge.
4. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull --ff-only
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

`release.yml` takes it from there: it runs `verify.py`, refuses if the tag and
`manifest.json` disagree, builds `dist/meeting-burn-X.Y.Z.zip` with `package.py`,
and publishes a GitHub Release using that version's changelog section as the notes.
Running the workflow by hand (`workflow_dispatch`) builds the same ZIP as an
artifact and releases nothing — that is how to check packaging before tagging.

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
performance, docs, the extension surfaces, release packaging.

**Out of scope — don't build these, propose them first:** accounts, a backend,
analytics or telemetry of any kind, anything that sends data off the device, and any
change that turns this into more than one file.

**Never do without being asked:** merge a PR, push to `main`, create a release or
tag, change repository settings or branch protection, force-push anything, or alter
`LICENSE`.
