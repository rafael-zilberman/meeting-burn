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
  const DEFAULTS = { salary: 20000, currency: "ILS", hours: 182, people: 5 };
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

  const $ = id => document.getElementById(id);

  /* ───────── formatting ───────── */
  const symOf = c => (CURRENCIES.find(x => x[0] === c) || [,, "$"])[2];
  const nfWhole = () => new Intl.NumberFormat(undefined, { style:"currency", currency:S.currency, maximumFractionDigits:0 });
  const nf2 = () => new Intl.NumberFormat(undefined, { style:"currency", currency:S.currency, minimumFractionDigits:2, maximumFractionDigits:2 });
  let FW = nfWhole(), F2 = nf2();
  const refreshFmt = () => { try { FW = nfWhole(); F2 = nf2(); } catch { S.currency = "USD"; FW = nfWhole(); F2 = nf2(); } };

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

  function begin(){
    refreshFmt();
    accumulated = 0; segmentAt = Date.now(); paused = false; lastWhole = -1;
    setPaused(false);
    $("runPeople").textContent = people;
    $("perMin").textContent = FW.format(perMinute());
    show("viewRun");
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
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
  }

  function finish(){
    if (!paused) accumulated += Date.now() - segmentAt;
    paused = true;
    cancelAnimationFrame(raf);
    const secs = accumulated / 1000;
    const total = secs * perSecond();

    $("total").textContent = F2.format(total);
    $("dDur").textContent = clock(secs);
    $("dPeople").textContent = people;
    $("dEach").textContent = F2.format(total / people);
    $("quip").innerHTML = quipFor(total, secs);
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
  $("again").addEventListener("click", () => { show("viewSetup"); renderPeople(); });

  $("copy").addEventListener("click", async e => {
    const secs = accumulated / 1000;
    const text = `Meeting cost: ${F2.format(secs * perSecond())}\n${people} people · ${clock(secs)} · ${FW.format(perMinute())}/min`;
    try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied ✓"; }
    catch { e.target.textContent = "Copy failed"; }
    setTimeout(() => { e.target.textContent = "Copy summary"; }, 1600);
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
    if (e.key === "Escape") return closeSheet();
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
  renderPeople();
})();
