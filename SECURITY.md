# Security Policy

## Supported versions

Meeting Burn is a single HTML file with no release branches. The version on `main`
is the supported version; fixes land there.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub:
[**Report a vulnerability**](https://github.com/rafael-zilberman/meeting-burn/security/advisories/new).
You'll get an acknowledgement within a few days, and I'll let you know whether it's
something I'm fixing and roughly when.

## Scope

This app runs entirely in your browser. It has no backend and stores nothing beyond
a small settings object, your meeting history and a short-lived calendar cache in
`localStorage`. It makes one network request — a read-only Google Calendar lookup,
and only if you connect a calendar in the extension. That rules out most of what
people usually report.

Genuinely in scope:

- Cross-site scripting through settings values or any other user input
- Anything that causes the page to load or execute external code
- A way to exfiltrate `localStorage` contents

Out of scope:

- Findings that require an already-compromised browser or device
- Missing security headers on the GitHub Pages demo (not under my control)
- Clickjacking on a page with no authenticated actions
- The absence of a Content Security Policy on `file://` usage
