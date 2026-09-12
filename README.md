# Meeting Burn

**Watch your meeting burn money in real time.**

Set how many people are in the room, hit start, and a live counter ticks upward for
every second the meeting runs. Stop it and you get the damage — total, per person,
and a comment you probably deserved.

🔗 **[Live demo](https://rafael-zilberman.github.io/meeting-burn/)**

---

## Why

Meetings feel free. They aren't. A one-hour sync with eight people isn't an hour —
it's a full working day of payroll, spent on talking. This makes that visible while
it's still happening, which is the only moment the information is useful.

## Features

- **Live counter** — the cost updates continuously, not once per second.
- **Configurable rate** — median *monthly* salary and working hours per month.
- **9 currencies** — ILS, USD, EUR, GBP, CAD, AUD, INR, JPY, BRL. Amounts are
  formatted with `Intl.NumberFormat`, so separators follow the viewer's locale.
- **Summary** — duration, headcount, cost per person, and a copyable one-liner
  for pasting into Slack.
- **Settings persist** in `localStorage`. Set it once.
- **Keyboard-driven** — `Space` starts and stops, `↑ ↓` adjust headcount, `Esc`
  closes settings.
- **Zero dependencies.** One HTML file. No build step, no npm install, no tracking,
  no network calls of any kind.

## Usage

Download [`index.html`](index.html) and open it in a browser. That's the whole install.

To run it from a local server instead:

```bash
git clone git@github.com:rafael-zilberman/meeting-burn.git && cd meeting-burn && python3 -m http.server 4187
```

Then open <http://localhost:4187>.

## How the cost is calculated

```
costPerPersonPerSecond = monthlySalary / workingHoursPerMonth / 3600
totalCost              = costPerPersonPerSecond × people × elapsedSeconds
```

Defaults are **₪20,000/month** across **182 hours** (the standard Israeli work
month) for **5 people** — about **₪9.16 per minute**.

Two notes on accuracy:

- **Use fully-loaded cost, not take-home salary.** Benefits, taxes, equipment and
  overhead typically add 25–50% on top of gross pay. If you enter a raw salary, the
  number you see is an underestimate.
- **Elapsed time comes from wall-clock timestamps**, not an accumulating counter, so
  the total stays correct even if the tab is backgrounded or throttled.

## Configuration

Open the ⚙︎ settings sheet to change:

| Setting | Default | Notes |
| --- | --- | --- |
| Median monthly salary | ₪20,000 | Quick-pick chips adapt to the chosen currency |
| Currency | ILS | Drives formatting everywhere in the app |
| Working hours per month | 182 | Use ~173 for a 40-hour week |

Settings are stored under the `mct.settings.v2` key in `localStorage` and never
leave the browser.

## Browser support

Any current version of Chrome, Edge, Firefox, or Safari. The design leans on
`backdrop-filter` and CSS gradient masks; in a browser without them the layout still
works, it just looks flatter. `prefers-reduced-motion` is respected — the animated
background and all transitions are disabled.

## Contributing

Issues and pull requests are welcome. The entire app is one file, so changes are
easy to read and easy to review. Please keep it that way: **no build step and no
runtime dependencies.**

## License

[MIT](LICENSE) © 2026 Rafael Zilberman
