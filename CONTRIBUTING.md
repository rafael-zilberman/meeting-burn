# Contributing to Meeting Burn

Thanks for taking the time. This is a small project with one strong opinion, and
that opinion shapes everything below.

## The one rule

**Meeting Burn is a single HTML file with no build step and no runtime
dependencies.** You should be able to download `index.html`, double-click it, and
have a working app — forever, with no toolchain, no `npm install`, and no CDN that
might disappear.

Contributions that add a framework, a bundler, a package manager, or an external
script/stylesheet/font will be declined, however good the code is. This isn't
gatekeeping for its own sake: the constraint is the product. CI enforces it, so a
PR that breaks it will fail before a human looks at it.

Everything else is open for discussion.

## Getting set up

```bash
git clone git@github.com:rafael-zilberman/meeting-burn.git
cd meeting-burn
python3 -m http.server 4187
```

Open <http://localhost:4187>. There is nothing to install and nothing to compile.

You can also just open `index.html` directly from the filesystem — everything works
except that `localStorage` behaves differently on `file://` in some browsers, so
prefer the server when testing settings persistence.

## Before you open a pull request

Run the checks locally. They're the same ones CI runs:

```bash
python3 scripts/verify.py
```

Then test by hand in at least one browser:

- Start a meeting, let it run, stop it. The total should match
  `people × (salary / hours / 3600) × seconds`.
- Change currency and salary in settings, reload the page, confirm they persisted.
- Try the keyboard: `Space` to start/stop, `↑ ↓` for headcount, `Esc` to close settings.
- Check it at a narrow width (~375px) and a wide one.
- If you touched anything animated, verify it with reduced motion enabled
  (macOS: System Settings → Accessibility → Display → Reduce motion).

## Style

There's no linter, so match what's already there:

- 2-space indentation, LF line endings, UTF-8 (`.editorconfig` handles this).
- CSS is organized in commented sections; keep colors and spacing as custom
  properties in `:root` rather than hardcoding values.
- JavaScript is plain ES2020+ in a single IIFE, `"use strict"`. No transpiling, so
  stick to syntax current browsers support natively.
- Prefer clarity over cleverness. Someone should be able to read this file top to
  bottom in one sitting.

## Commit messages

Write a short imperative subject line ("Add pause button", not "Added" or "Adds").
If the change needs explanation, add a blank line and a body saying *why*, not what
— the diff already says what.

## Reporting bugs

Open an issue using the bug report template. The most useful thing you can include
is the exact settings you used (salary, hours, currency, headcount) and what number
you expected versus what you saw.

## Proposing features

Open an issue first for anything larger than a bug fix, so you don't spend an
evening on something that turns out to be off-scope. Good candidates: pause/resume,
meeting history, cost-per-attendee breakdowns, sharing. Off-scope: accounts,
backends, analytics, anything that phones home.

## Code of conduct

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Contributions are licensed under the [MIT License](LICENSE), same as the project.
