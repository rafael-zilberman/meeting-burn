(() => {
  "use strict";

  /* ───────── extension surface ─────────
     The manifest points the popup at ?surface=popup and the side panel at
     ?surface=panel. Loaded as a plain web page there is no parameter and
     nothing below applies. */
  const SURFACE = new URLSearchParams(location.search).get("surface");
  if (SURFACE === "popup" || SURFACE === "panel") {
    document.documentElement.classList.add("ext", "ext-" + SURFACE);
  }

  /* ───────── config + persistence ───────── */
  const KEY = "mct.settings.v2";
  // salary is MONTHLY; hours are working hours per MONTH
  const DEFAULTS = { salary: 20000, currency: "ILS", hours: 182, people: 5, calendar: false };
  const CURRENCIES = [
    ["ILS","Israeli Shekel","₪"], ["USD","US Dollar","$"], ["EUR","Euro","€"],
    ["GBP","British Pound","£"], ["CAD","Canadian Dollar","$"], ["AUD","Australian Dollar","$"],
    ["INR","Indian Rupee","₹"], ["JPY","Japanese Yen","¥"], ["BRL","Brazilian Real","R$"],
  ];
  // rough price of a team lunch, per currency — used only for the summary quip
  const LUNCH = { ILS:55, USD:15, EUR:14, GBP:12, CAD:20, AUD:22, INR:300, JPY:1200, BRL:40 };

  let S = { ...DEFAULTS };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  // A popup is torn down the moment it loses focus, so the live meeting is kept
  // in storage and rebuilt on the next open. Times are absolute epoch ms, which
  // means a session survives being closed for an hour just as well as a blink.
  const SKEY = "mct.session.v1";
  // The history entry the summary screen is currently naming, so reopening the
  // popup on a finished meeting keeps editing that entry instead of adding one.
  let historyId = null;
  const loadSession = () => { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch { return null; } };
  const saveSession = phase => {
    try { localStorage.setItem(SKEY, JSON.stringify({ phase, accumulated, segmentAt, paused, people, historyId, pendingName })); } catch {}
  };
  const clearSession = () => { try { localStorage.removeItem(SKEY); } catch {} };

  const $ = id => document.getElementById(id);

  /* ───────── formatting ───────── */
  const symOf = c => (CURRENCIES.find(x => x[0] === c) || [,, "$"])[2];
  const nfWhole = () => new Intl.NumberFormat(undefined, { style:"currency", currency:S.currency, maximumFractionDigits:0 });
  const nf2 = () => new Intl.NumberFormat(undefined, { style:"currency", currency:S.currency, minimumFractionDigits:2, maximumFractionDigits:2 });
  let FW = nfWhole(), F2 = nf2();
  const refreshFmt = () => { try { FW = nfWhole(); F2 = nf2(); } catch { S.currency = "USD"; FW = nfWhole(); F2 = nf2(); } };

  // History entries are shown in the currency they were recorded in, not the
  // current setting — an old meeting's cost is a fact, not a live conversion.
  const money2 = (v, cur) => {
    try { return new Intl.NumberFormat(undefined, { style:"currency", currency:cur, minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
    catch { return new Intl.NumberFormat(undefined, { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:2 }).format(v); }
  };
  const stamp = new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
  const hhmm  = new Intl.DateTimeFormat(undefined, { hour:"numeric", minute:"2-digit" });

  const clock = s => {
    s = Math.floor(s);
    const h = Math.floor(s/3600), m = Math.floor(s%3600/60), sec = s%60;
    const pad = n => String(n).padStart(2,"0");
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };

  /* ───────── rates ───────── */
  const perPersonSecond = () => (Number(S.salary) || 0) / (Number(S.hours) || 182) / 3600;
  const perSecond = () => perPersonSecond() * people;
  const perMinute = () => perSecond() * 60;

  /* ───────── state ───────── */
  let people = Math.max(1, Math.min(200, Number(S.people) || 5));
  // A meeting is a series of counted segments. `accumulated` holds the milliseconds
  // banked by finished segments; `segmentAt` is when the current one began. Cost only
  // ever derives from wall-clock deltas, so throttled tabs stay accurate.
  let accumulated = 0, segmentAt = 0, paused = false, raf = 0, lastWhole = -1;
  const elapsedMs = () => accumulated + (paused ? 0 : Date.now() - segmentAt);

  // The name this meeting will be filed under. It arrives from the calendar
  // event you're in, rides through the meeting, and is written onto the history
  // entry when it ends — where the summary screen takes over and edits it.
  let pendingName = "";

  /* ───────── setup view ───────── */
  const elCount = $("count"), elPeople = $("people"), elRate = $("ratePreview");

  function renderPeople(){
    elCount.textContent = people;
    elCount.classList.remove("bump"); void elCount.offsetWidth; elCount.classList.add("bump");

    const show = Math.min(people, 24);
    if (elPeople.children.length !== show) {
      elPeople.innerHTML = "";
      for (let i = 0; i < show; i++) {
        const d = document.createElement("div");
        d.className = "dot";
        d.style.animationDelay = (i * 18) + "ms";
        elPeople.appendChild(d);
      }
    }
    $("minus").disabled = people <= 1;
    $("plus").disabled = people >= 200;
    elRate.textContent = F2.format(perMinute());
  }

  const nudge = n => { people = Math.max(1, Math.min(200, people + n)); S.people = people; save(); renderPeople(); };
  $("minus").addEventListener("click", () => nudge(-1));
  $("plus").addEventListener("click",  () => nudge(+1));

  /* ───────── view switching ───────── */
  function show(id){
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  }

  /* ───────── running ───────── */
  const elAmount = $("amount"), elMoney = $("money");

  function paintAmount(v){
    const whole = Math.floor(v);
    const cents = Math.floor((v - whole) * 100);
    elAmount.innerHTML =
      FW.format(whole) + `<span class="cents">.${String(cents).padStart(2,"0")}</span>`;
    if (whole !== lastWhole) lastWhole = whole;
  }

  function paint(){
    const secs = elapsedMs() / 1000;
    const cost = secs * perSecond();
    paintAmount(cost);
    $("elapsed").textContent = clock(secs);
    elMoney.classList.toggle("hot", cost >= (LUNCH[S.currency] || 15) * 33);
    return cost;
  }

  function tick(){
    paint();
    raf = requestAnimationFrame(tick);
  }

  function enterRun(){
    refreshFmt();
    setPaused(paused);
    $("runPeople").textContent = people;
    $("perMin").textContent = FW.format(perMinute());
    renderInvite();
    show("viewRun");
    cancelAnimationFrame(raf);
    paint();
    if (!paused) raf = requestAnimationFrame(tick);
  }

  function begin(){
    accumulated = 0; segmentAt = Date.now(); paused = false; lastWhole = -1;
    historyId = null;   // this meeting gets its entry when it ends
    enterRun();
    saveSession("run");
  }

  function setPaused(on){
    paused = on;
    $("viewRun").classList.toggle("paused", on);
    $("liveLabel").textContent = on ? "Paused" : "In session";
    $("pauseLabel").textContent = on ? "Resume" : "Pause";
    $("pause").setAttribute("aria-pressed", String(on));
    $("pauseIcon").innerHTML = on
      ? '<path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.1-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/>'
      : '<rect x="7" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4"/>';
  }

  function togglePause(){
    if (paused) {
      segmentAt = Date.now();
      setPaused(false);
      raf = requestAnimationFrame(tick);
    } else {
      accumulated += Date.now() - segmentAt;   // bank the segment before stopping the clock
      cancelAnimationFrame(raf);
      setPaused(true);
      paint();
    }
    saveSession("run");
  }

  function finish(){
    if (!paused) accumulated += Date.now() - segmentAt;
    paused = true;
    cancelAnimationFrame(raf);
    historyId = record();
    showDone();
    saveSession("done");
  }

  function showDone(){
    refreshFmt();
    const secs = accumulated / 1000;
    const total = secs * perSecond();

    $("total").textContent = F2.format(total);
    $("dDur").textContent = clock(secs);
    $("dPeople").textContent = people;
    $("dEach").textContent = F2.format(total / people);
    $("quip").innerHTML = quipFor(total, secs);
    const entry = entryFor(historyId);
    elName.value = entry ? entry.name : "";
    show("viewDone");
  }

  /* ───────── a little perspective ───────── */
  function quipFor(total, secs){
    const mins = secs / 60;
    const lunch = LUNCH[S.currency] || 15;
    const opts = [
      [lunch * 0.5,  "About a decent cup of coffee. Carry on."],
      [lunch * 2.5,  `That's <em>${F2.format(total)}</em> of payroll — roughly a team lunch.`],
      [lunch * 10,   `Enough for <em>${Math.max(1, Math.round(total / lunch))}</em> lunches. Was the agenda worth it?`],
      [lunch * 40,   `<em>${F2.format(total)}</em> — that's a nice monitor, spent on talking.`],
      [lunch * 200,  `<em>${F2.format(total)}</em> burned. This could have been a document.`],
      [Infinity,     `<em>${F2.format(total)}</em>. Genuinely, this could have been an email.`],
    ];
    const line = opts.find(([cap]) => total < cap)[1];
    const rate = FW.format(perMinute());
    return `${line}<br><span style="color:var(--ink-faint)">${people} people · ${rate}/min · ${mins < 1 ? "under a minute" : Math.round(mins) + " min"}</span>`;
  }

  $("start").addEventListener("click", begin);
  $("pause").addEventListener("click", togglePause);
  $("stop").addEventListener("click", finish);
  $("again").addEventListener("click", () => {
    clearSession();
    people = Math.max(1, Math.min(200, Number(S.people) || 5));
    calEvents = []; calIndex = 0; calMeta = "";
    setPendingName("");
    show("viewSetup");
    renderPeople();
    calLook(false);   // the next meeting may already have started
  });

  $("copy").addEventListener("click", async e => {
    const secs = accumulated / 1000;
    const entry = entryFor(historyId);
    const title = entry && entry.name ? entry.name + "\n" : "";
    const text = `${title}Meeting cost: ${F2.format(secs * perSecond())}\n${people} people · ${clock(secs)} · ${FW.format(perMinute())}/min`;
    try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied ✓"; }
    catch { e.target.textContent = "Copy failed"; }
    setTimeout(() => { e.target.textContent = "Copy summary"; }, 1600);
  });

  /* ───────── meeting history ───────── */
  // Finished meetings, newest first. Each entry freezes the cost, the currency
  // and the headcount as they were when the meeting ended, so changing the salary
  // later rewrites the rate preview but never the past.
  const HKEY = "mct.history.v1";
  const HIST_MAX = 50;
  let hist = [];
  try { const raw = JSON.parse(localStorage.getItem(HKEY) || "[]"); if (Array.isArray(raw)) hist = raw; } catch {}
  const saveHist = () => { try { localStorage.setItem(HKEY, JSON.stringify(hist)); } catch {} };
  const entryFor = id => (id ? hist.find(e => e.id === id) : undefined);

  function record(){
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: pendingName,
      endedAt: Date.now(),
      ms: accumulated,
      people,
      cost: (accumulated / 1000) * perSecond(),
      currency: S.currency,
    };
    hist.unshift(entry);
    if (hist.length > HIST_MAX) hist.length = HIST_MAX;
    saveHist();
    return entry.id;
  }

  const elName = $("meetingName"), elHistList = $("histList"), elHistTotal = $("histTotal");
  const clearBtn = $("clearHistory");

  elName.addEventListener("input", () => {
    const entry = entryFor(historyId);
    if (!entry) return;
    entry.name = elName.value.trim();
    pendingName = entry.name;
    saveHist();
  });

  const DEL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/>' +
    '<path d="M6 7l1 12.4a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5L18 7"/>' +
    '<path d="M9 7V4.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/></svg>';

  function histRow(e){
    const li = document.createElement("li");
    li.className = "hist-item";

    const main = document.createElement("div");
    main.className = "hist-main";
    const name = document.createElement("div");
    name.className = e.name ? "hist-name" : "hist-name untitled";
    name.textContent = e.name || "Untitled meeting";        // textContent: a name is user input
    const meta = document.createElement("div");
    meta.className = "hist-meta";
    meta.textContent = `${stamp.format(new Date(e.endedAt))} · ${clock(e.ms / 1000)} · ` +
      `${e.people} ${e.people === 1 ? "person" : "people"}`;
    main.append(name, meta);

    const cost = document.createElement("div");
    cost.className = "hist-cost";
    cost.textContent = money2(e.cost, e.currency);

    const del = document.createElement("button");
    del.className = "hist-del";
    del.type = "button";
    del.setAttribute("aria-label", `Delete ${e.name || "untitled meeting"}`);
    del.innerHTML = DEL_ICON;
    del.addEventListener("click", () => {
      hist = hist.filter(x => x.id !== e.id);
      saveHist();
      renderHistory();
    });

    li.append(main, cost, del);
    return li;
  }

  function renderHistory(){
    elHistList.innerHTML = "";
    clearBtn.textContent = "Clear all";
    clearBtn.hidden = !hist.length;

    if (!hist.length) {
      const li = document.createElement("li");
      li.className = "hist-empty";
      li.textContent = "No meetings yet. End one and it lands here.";
      elHistList.appendChild(li);
      elHistTotal.textContent = "";
      return;
    }

    // Currencies are never added together; each one gets its own total.
    const totals = new Map();
    for (const e of hist) totals.set(e.currency, (totals.get(e.currency) || 0) + e.cost);
    elHistTotal.textContent = `${hist.length} meeting${hist.length === 1 ? "" : "s"} · ` +
      [...totals].map(([cur, sum]) => money2(sum, cur)).join(" + ");

    for (const e of hist) elHistList.appendChild(histRow(e));
  }

  let backView = "viewSetup";
  function openHistory(){
    const current = document.querySelector(".view.active");
    if (current && current.id !== "viewHistory") backView = current.id;
    renderHistory();
    show("viewHistory");
  }
  const closeHistory = () => show(backView);

  $("openHistory").addEventListener("click", openHistory);
  $("histBack").addEventListener("click", closeHistory);

  // Clearing is destructive and there is no undo, so it takes two taps rather
  // than a confirm() — extension popups are a poor place for a modal dialog.
  let clearTimer = 0;
  clearBtn.addEventListener("click", () => {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = 0;
      hist = [];
      saveHist();
      renderHistory();
      return;
    }
    clearBtn.textContent = "Tap again to clear";
    clearTimer = setTimeout(() => { clearTimer = 0; clearBtn.textContent = "Clear all"; }, 4000);
  });

  /* ───────── the meeting you're in ─────────
     A chip on the setup view showing the event the headcount and name came
     from, and the same name above the counter once it's running. Every string
     here arrives from a calendar this app does not control, so all of it is set
     with textContent and never innerHTML. */
  const elInvite = $("invite"), elInviteTitle = $("inviteTitle"),
        elInviteMeta = $("inviteMeta"), elInviteNext = $("inviteNext"),
        elRunTitle = $("runTitle");

  function setPendingName(name){
    pendingName = String(name || "").replace(/\s+/g, " ").trim().slice(0, 60);
    renderInvite();
  }

  function renderInvite(){
    elInvite.hidden = !pendingName;
    elInviteTitle.textContent = pendingName;
    elInviteMeta.textContent = calMeta;
    elInviteNext.disabled = calEvents.length < 2;
    elRunTitle.hidden = !pendingName;
    elRunTitle.textContent = pendingName;
  }

  $("inviteClear").addEventListener("click", () => {
    calEvents = []; calIndex = 0; calMeta = "";
    setPendingName("");
  });

  // Back-to-back invitations are the normal case at the times this app gets
  // opened, so the chip cycles rather than insisting on its first guess.
  elInviteNext.addEventListener("click", () => {
    if (calEvents.length < 2) return;
    calIndex = (calIndex + 1) % calEvents.length;
    calApply();
  });

  /* ───────── google calendar ─────────
     The only network call this app makes, and only when running as an extension
     with a calendar connected: Chrome's identity API holds the token and one
     read asks which events are on your calendar right now. Nothing is uploaded,
     nothing goes anywhere but Google, and the reply is reduced to a title, a
     start time and a count before it is cached — attendee names and addresses
     are counted and dropped rather than written to disk.

     The web demo has no chrome.*, so none of this runs there. */
  const CAL_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const CAL_KEY = "mct.calendar.v1";
  const CAL_TTL = 60000;            // a popup opened twice in a minute asks once
  const CAL_LOOKAHEAD = 5 * 60000;  // an event about to start already counts as now
  const HAS_IDENTITY = typeof chrome !== "undefined" && !!(chrome.identity && chrome.runtime);

  let calEvents = [];   // candidates for "the meeting you're in", best guess first
  let calIndex = 0;
  let calMeta = "";

  // The OAuth client is per-installation and is not in the repo — see the
  // README. Without one the feature stays quietly off instead of failing on
  // every open.
  function calConfigured(){
    if (!HAS_IDENTITY) return false;
    try {
      const o = chrome.runtime.getManifest().oauth2;
      return !!(o && o.client_id && !/^REPLACE/.test(o.client_id));
    } catch { return false; }
  }

  const calToken = interactive => new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive }, token => {
      // A refused or absent grant is an ordinary outcome here, not a failure;
      // reading lastError is what stops Chrome logging it as one.
      if (chrome.runtime.lastError) { void chrome.runtime.lastError.message; return resolve(null); }
      resolve(token || null);
    });
  });

  const calDrop = token => new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));

  async function calRead(interactive){
    const token = await calToken(interactive);
    if (!token) return null;
    const now = Date.now();
    const q = new URLSearchParams({
      timeMin: new Date(now).toISOString(),
      timeMax: new Date(now + CAL_LOOKAHEAD).toISOString(),
      singleEvents: "true",   // Google expands recurring events; we don't parse rules
      orderBy: "startTime",
      maxResults: "10",
    });
    let res;
    try { res = await fetch(CAL_ENDPOINT + "?" + q, { headers: { Authorization: "Bearer " + token } }); }
    catch { return null; }                      // offline, blocked, whatever — the app works without it
    if (res.status === 401) { await calDrop(token); return null; }   // Chrome cached a dead token
    if (!res.ok) return null;
    try { return (await res.json()).items || []; } catch { return null; }
  }

  const calSelf = (e, status) => (e.attendees || []).some(a => a.self && a.responseStatus === status);

  // Meeting rooms accept invitations too, and a room draws no salary. Counting
  // one would be exactly wrong for the in-person meetings this exists for.
  function calHeadcount(e){
    if (e.attendeesOmitted) return 0;
    const n = (e.attendees || []).filter(a => !a.resource && a.responseStatus === "accepted").length;
    return n > 1 ? Math.min(200, n) : 0;   // one acceptance is just you; not a meeting
  }

  function calCandidates(items){
    const now = Date.now();
    const rows = items
      // An all-day entry has a `date` rather than a `dateTime`, and is a label
      // on the day rather than a meeting anyone is sitting in.
      .filter(e => e.status !== "cancelled" && e.start && e.start.dateTime && !calSelf(e, "declined"))
      .map(e => ({ e, start: Date.parse(e.start.dateTime), end: Date.parse((e.end || {}).dateTime || "") }))
      .filter(x => Number.isFinite(x.start) && Number.isFinite(x.end));

    const live = rows.filter(x => x.start <= now && now < x.end);
    const pool = live.length ? live : rows.filter(x => x.start > now);
    // Overlapping invitations: the one you accepted wins, then the shorter one.
    const yes = x => (calSelf(x.e, "accepted") ? 1 : 0);
    pool.sort((a, b) => yes(b) - yes(a) || (a.end - a.start) - (b.end - b.start) || a.start - b.start);

    // Only these three fields survive. Everything else the API returned —
    // attendee names, addresses, the description, the conference link — is
    // dropped here and never stored.
    return pool.map(x => ({
      title: String(x.e.summary || "Untitled event").replace(/\s+/g, " ").trim().slice(0, 60),
      at: x.start,
      people: calHeadcount(x.e),
      from: "api",
    }));
  }

  const calCache = {
    read(){
      try {
        const c = JSON.parse(localStorage.getItem(CAL_KEY) || "null");
        return c && Date.now() - c.at < CAL_TTL && Array.isArray(c.rows) ? c.rows : null;
      } catch { return null; }
    },
    write(rows){ try { localStorage.setItem(CAL_KEY, JSON.stringify({ at: Date.now(), rows })); } catch {} },
    clear(){ try { localStorage.removeItem(CAL_KEY); } catch {} },
  };

  function calApply(){
    const e = calEvents[calIndex];
    if (!e) { calMeta = ""; setPendingName(""); return; }
    // The headcount is prefilled for this meeting but deliberately not saved:
    // the calendar fills in a run, it doesn't rewrite the default you chose.
    if (e.people) { people = e.people; renderPeople(); }
    const bits = [];
    if (e.people) bits.push(e.people + (e.from === "tab" ? " guests" : " accepted"));
    if (e.at) bits.push(hhmm.format(new Date(e.at)));
    if (e.from === "tab") bits.push("from this tab");
    if (calEvents.length > 1) bits.push(`${calIndex + 1}/${calEvents.length}`);
    calMeta = bits.join(" · ");
    setPendingName(e.title);
  }

  async function calRefresh(interactive){
    if (!calConfigured() || !S.calendar) return;
    let rows = calCache.read();
    if (!rows) {
      const items = await calRead(interactive);
      if (!items) return;
      rows = calCandidates(items);
      calCache.write(rows);
    }
    calEvents = rows;
    calIndex = 0;
    // Only ever fills in the setup screen. A meeting already running keeps the
    // headcount it started with.
    if ($("viewSetup").classList.contains("active")) calApply();
    syncCalRow();
  }


  /* ───────── the calendar tab you're looking at ─────────
     A fallback for when the API can't answer: no OAuth client configured, not
     connected, or the event lives on a calendar the `primary` query doesn't
     cover. If the tab you had open when you clicked the toolbar icon is Google
     Calendar **with an event open**, that event is read off the page.

     This needs no host permission and no content script. `activeTab` grants
     access to exactly one tab, only because you clicked the icon, and only
     until the popup closes; the reading function below is injected from this
     file, so there is still no fourth file in the repo. The side panel gets no
     such grant, so there it simply finds nothing. */
  const TAB_HOST = "calendar.google.com";
  const HAS_SCRIPTING = typeof chrome !== "undefined" && !!(chrome.scripting && chrome.tabs);

  // ⚠ Runs inside the Google Calendar page, not here. It is serialised and
  // injected, so it can see nothing from this file and must stay standalone.
  // Everything it returns is page text: data, never instructions, and the
  // caller caps and escapes it like any other untrusted string.
  //
  // Only an event you have open is read. Scanning the grid was tried and
  // removed: a week view renders seven days of chips, nothing in a chip
  // reliably says which day it belongs to, and matching on the time of day
  // alone confidently picks up yesterday's 11am. A wrong headcount is worse
  // than none — it is the number this whole app exists to get right — so the
  // page is only asked about the event you pointed at.
  function readCalendarPage(){
    const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

    // Google's class names are generated and change; the dialog role and the
    // visible text are what stay put.
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;

    const heading = dialog.querySelector("h1, h2, [role='heading']");
    const title = clean(heading && heading.textContent);
    if (!title) return null;

    const text = clean(dialog.innerText);
    const yes = text.match(/(\d+)\s*yes/i) || text.match(/(\d+)\s*accepted/i);
    const all = text.match(/(\d+)\s*guests?/i);
    const n = Number((yes || all || [])[1] || 0);

    return { title: title.slice(0, 60), people: n > 1 ? Math.min(200, n) : 0 };
  }

  async function calTabRead(){
    if (!HAS_SCRIPTING) return null;
    let tab;
    try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { return null; }
    // No url means no activeTab grant — the side panel, or a tab opened since
    // the click. Nothing to read, and nothing worth reporting.
    if (!tab || !tab.url || !tab.id) return null;
    let host = "";
    try { host = new URL(tab.url).hostname; } catch { return null; }
    if (host !== TAB_HOST) return null;

    let hit;
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readCalendarPage });
      hit = res && res.result;
    } catch { return null; }   // the grant expired, or the page refused injection
    if (!hit || !hit.title) return null;

    return {
      title: String(hit.title).replace(/\s+/g, " ").trim().slice(0, 60),
      at: 0,   // an open event doesn't show its date; only the API supplies a time
      people: Math.max(0, Math.min(200, Math.floor(Number(hit.people) || 0))),
      from: "tab",
    };
  }

  // The API first; the tab you're on only when it came back with nothing.
  async function calLook(interactive){
    await calRefresh(interactive);
    if (calEvents.length) return;
    const row = await calTabRead();
    if (!row) return;
    calEvents = [row];
    calIndex = 0;
    if ($("viewSetup").classList.contains("active")) calApply();
    syncCalRow();
  }

  const calRow = $("calRow"), calBtn = $("calConnect"), calStatus = $("calStatus");

  function syncCalRow(){
    calRow.hidden = !HAS_IDENTITY;          // the web demo has no calendar to connect
    if (!HAS_IDENTITY) return;
    if (!calConfigured()) {
      calBtn.hidden = true;
      calStatus.textContent = "This build has no OAuth client configured — see the README.";
      return;
    }
    calBtn.hidden = false;
    calBtn.textContent = S.calendar ? "Disconnect" : "Connect Google Calendar";
    calStatus.textContent = S.calendar
      ? (calEvents.length
          ? `Connected. ${calEvents.length} event${calEvents.length === 1 ? "" : "s"} around now.`
          : "Connected. Nothing on your calendar right now.")
      : "Fills in the headcount and the name from the meeting you're in. Read-only, checked only while this is open."
        + (HAS_SCRIPTING ? " Not connected, it still reads an event you have open on a Google Calendar tab." : "");
  }

  calBtn.addEventListener("click", async () => {
    if (S.calendar) {
      S.calendar = false; save();
      calEvents = []; calIndex = 0; calMeta = "";
      calCache.clear();
      setPendingName("");
      // Drops Chrome's cached token. Revoking the grant itself is a second
      // network call to a second endpoint, so that stays a link in the README
      // to your Google account rather than a request from here.
      const token = await calToken(false);
      if (token) await calDrop(token);
      syncCalRow();
      return;
    }
    calBtn.disabled = true;
    calStatus.textContent = "Waiting for Google…";
    const token = await calToken(true);
    calBtn.disabled = false;
    if (!token) { calStatus.textContent = "Not connected — Google didn't grant access."; return; }
    S.calendar = true; save();
    await calLook(false);
    syncCalRow();
  });

  /* ───────── settings sheet ───────── */
  const sheet = $("sheet"), scrim = $("scrim");
  const elSalary = $("salary"), elCur = $("currency"), elHours = $("hours"), elSym = $("curSym");

  CURRENCIES.forEach(([code, name]) => {
    const o = document.createElement("option");
    o.value = code; o.textContent = `${code} — ${name}`;
    elCur.appendChild(o);
  });

  const PRESETS = { ILS:[12000,18000,25000,35000,50000], DEFAULT:[4000,6000,9000,13000,18000] };
  const chips = $("chips");
  for (let i = 0; i < 5; i++) {
    const b = document.createElement("button");
    b.className = "chip"; b.type = "button";
    b.addEventListener("click", () => { S.salary = Number(b.dataset.v); save(); syncSheet(); refreshAll(); });
    chips.appendChild(b);
  }

  function syncSheet(){
    elSalary.value = S.salary;
    elCur.value = S.currency;
    elHours.value = S.hours;
    elSym.textContent = symOf(S.currency);
    const preset = PRESETS[S.currency] || PRESETS.DEFAULT;
    chips.querySelectorAll(".chip").forEach((c, i) => {
      c.dataset.v = preset[i];
      c.textContent = new Intl.NumberFormat(undefined, {
        style:"currency", currency:S.currency, maximumFractionDigits:0, notation:"compact"
      }).format(preset[i]);
    });
  }

  function refreshAll(){ refreshFmt(); renderPeople(); }

  elSalary.addEventListener("input", () => { S.salary = Math.max(0, Number(elSalary.value) || 0); save(); refreshAll(); });
  elHours.addEventListener("input",  () => { S.hours  = Math.max(1, Number(elHours.value) || 182); save(); refreshAll(); });
  elCur.addEventListener("change",   () => { S.currency = elCur.value; save(); syncSheet(); refreshAll(); });

  const openSheet  = () => { syncSheet(); sheet.classList.add("open"); scrim.classList.add("open"); };
  const closeSheet = () => { sheet.classList.remove("open"); scrim.classList.remove("open"); };
  $("openSettings").addEventListener("click", openSheet);
  $("closeSettings").addEventListener("click", closeSheet);
  scrim.addEventListener("click", closeSheet);

  /* ───────── keyboard ───────── */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (sheet.classList.contains("open")) return closeSheet();
      if ($("viewHistory").classList.contains("active")) return closeHistory();
      return;
    }
    if (sheet.classList.contains("open")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      if ($("viewSetup").classList.contains("active")) begin();
      else if ($("viewRun").classList.contains("active")) togglePause();
    }
    if (e.key === "Enter" && $("viewRun").classList.contains("active")) {
      e.preventDefault();
      finish();
    }
    if ($("viewSetup").classList.contains("active")) {
      if (e.key === "ArrowUp"   || e.key === "ArrowRight") { e.preventDefault(); nudge(+1); }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft")  { e.preventDefault(); nudge(-1); }
    }
  });

  /* ───────── popup → side panel ───────── */
  if (SURFACE === "popup" && typeof chrome !== "undefined" && chrome.sidePanel) {
    const panelBtn = $("openPanel");
    panelBtn.hidden = false;
    panelBtn.addEventListener("click", async () => {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    });
  }

  /* ───────── boot ───────── */
  refreshFmt();
  syncSheet();
  syncCalRow();
  renderPeople();

  const restored = loadSession();
  if (restored && (restored.phase === "run" || restored.phase === "done")) {
    accumulated = Number(restored.accumulated) || 0;
    segmentAt   = Number(restored.segmentAt) || Date.now();
    paused      = !!restored.paused;
    people      = Math.max(1, Math.min(200, Number(restored.people) || people));
    lastWhole   = -1;
    historyId   = restored.historyId || null;
    setPendingName(restored.pendingName || "");
    if (restored.phase === "run") enterRun();
    else {
      // A summary saved before history existed has no entry; give it one now.
      if (!historyId) { historyId = record(); saveSession("done"); }
      showDone();
    }
  }

  // Nothing in progress, so ask what you're meant to be in right now.
  if (!restored) calLook(false);
})();
