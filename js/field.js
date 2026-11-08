// الملعب: جدولة الدوري، شاشة المباراة (تايمر، أهداف، بطاقات، بطاقات القوة)، الجمع، نقاط الألعاب، ورابط الحكم.
import * as L from "./logic.js";
import { db, ApiError } from "./api.js";

// ---------------- pure helpers (testable) ----------------
const samePair = (p, a, b) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
/** one leg of a round robin (circle method). The round that holds `first` goes first, with `first` as its opening match. */
export function pairRounds(ids, first) {
  const arr = ids.slice(); if (arr.length % 2) arr.push(null);
  const n = arr.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a != null && b != null) ms.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(ms);
    arr.splice(1, 0, arr.pop());
  }
  if (first && first[0] != null && first[1] != null && first[0] !== first[1]) {
    const k = rounds.findIndex((ms) => ms.some((p) => samePair(p, first[0], first[1])));
    if (k > 0) rounds.unshift(rounds.splice(k, 1)[0]);
    const r0 = rounds[0]; const j = r0.findIndex((p) => samePair(p, first[0], first[1]));
    if (j >= 0) { r0.splice(j, 1); r0.unshift([first[0], first[1]]); }
  }
  return rounds;
}
/** full league: every pairing once per leg, the second leg swaps home and away */
export function leagueRounds(ids, first, legs = 2) {
  const one = pairRounds(ids, first); const out = one.map((r) => r.map((p) => p.slice()));
  for (let l = 1; l < legs; l++) out.push(...one.map((r) => r.map(([a, b]) => (l % 2 ? [b, a] : [a, b]))));
  return out;
}
/** rounds → match rows, one round per meeting from `fromIdx`, keeping the last meeting for the final */
export function planSchedule(meetings, fromIdx, rounds) {
  const slots = meetings.slice(fromIdx, Math.max(fromIdx, meetings.length - 1));
  const rows = []; let short = 0;
  rounds.forEach((ms, i) => { const mt = slots[i]; if (!mt) short++; ms.forEach(([h, a]) => rows.push({ round: i + 1, stage: "league", meeting_id: mt ? mt.id : null, home_id: h, away_id: a })); });
  return { rows, short };
}
export const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export const RESPONSE = (kind) => (L.POWER[kind] || {}).when === "ردًّا";
export const GATHER_PTS = [3, 2, 1];
export const GAME_MAX = { perf: 7, coop: 3 };

// ---------------- module ----------------
export function initField(ctx) {
  const { esc, toast } = ctx;
  const ui = { fb: null, fbPlan: null, pick: null, finish: null, coin: {}, gather: null, game: null, linkOpen: false, armed: null };
  let mode = "staff", tok = null, FS = null, FSerr = null;
  const pending = {}; // mid -> {h,a} not yet saved
  let saveT = null, saving = false;
  const $app = () => document.getElementById("app");
  const carStyle = (c) => `--tc:${esc(c ? c.color : "#6b7cff")}`;
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  // ---- model: same shape for the staff app and the referee link
  function M() {
    if (mode === "field") {
      const F = FS || { caravans: [], kids: [], matches: [], goals: [], cards: [], power: [] };
      return { edit: true, caravans: F.caravans, car: (id) => F.caravans.find((c) => c.id === id), kidsOf: (cid) => F.kids.filter((k) => k.caravan_id === cid),
        kid: (id) => F.kids.find((k) => k.id === id), matches: F.matches, goals: F.goals, cards: F.cards, power: F.power || [], meeting: F.meeting };
    }
    const S = ctx.S(), I = ctx.I();
    return { edit: ctx.can("league"), caravans: S.caravans, car: (id) => I.car[id], kidsOf: (cid) => L.kidsOf(S, cid), kid: (id) => I.kid[id],
      matches: S.matches, goals: S.goals, cards: S.cards, power: S.power_cards || [], meeting: I.meet[ctx.meetId()] };
  }
  const T = (fn, args) => db.rpc(fn, { tok, ...args });
  const now = () => new Date().toISOString();
  async function refresh(...tables) {
    if (mode === "field") { FS = await T("field_state", {}); for (const mid in pending) { const m = FS.matches.find((x) => String(x.id) === mid); if (m) { m.home_goals = pending[mid].h; m.away_goals = pending[mid].a; } } }
    else if (tables.length) await ctx.reload(...tables);
  }
  const ops = {
    score: (m, h, a) => (mode === "field" ? T("field_score", { m: m.id, hg: h, ag: a }) : db.update("matches", { id: m.id }, { home_goals: h, away_goals: a, ...(m.started_at ? {} : { started_at: now() }) })),
    finish: (m, h, a, fh, fa) => (mode === "field" ? T("field_finish", { m: m.id, hg: h, ag: a, fh, fa }) : db.update("matches", { id: m.id }, { home_goals: h, away_goals: a, played: true, fair_home: fh, fair_away: fa, ...(m.started_at ? {} : { started_at: now() }) })),
    reopen: (m) => (mode === "field" ? T("field_reopen", { m: m.id }) : db.update("matches", { id: m.id }, { played: false })),
    goalAdd: (mid, kid) => (mode === "field" ? T("field_goal_add", { m: mid, kid }) : db.insert("goals", [{ match_id: mid, kid_id: kid }])),
    goalDel: (id) => (mode === "field" ? T("field_goal_del", { gid: id }) : db.remove("goals", { id })),
    cardAdd: (mid, kid, col, why) => (mode === "field" ? T("field_card_add", { m: mid, kid, col, why: why || "" }) : db.insert("cards", [{ match_id: mid, kid_id: kid, color: col, reason: why || "" }])),
    cardDel: (id) => (mode === "field" ? T("field_card_del", { cid: id }) : db.remove("cards", { id })),
    power: (pid, mid) => (mode === "field" ? T("field_power", { pid, m: mid }) : db.update("power_cards", { id: pid }, { used_match_id: mid, used_at: mid ? now() : null })),
  };
  async function run(fn, tables, okMsg) {
    try { const r = await fn(); await refresh(...tables); if (okMsg) toast(okMsg); return r === undefined ? true : r; }
    catch (e) { toast(e instanceof ApiError ? e.message : "ما انحفظ: " + (e.message || e), "err"); console.error(e); return undefined; }
  }

  // ---- score: instant on screen, saved in the background (retries if the net drops)
  function setScore(m, h, a) {
    m.home_goals = Math.max(0, h); m.away_goals = Math.max(0, a);
    pending[m.id] = { h: m.home_goals, a: m.away_goals };
    flushSoon(250);
  }
  function flushSoon(ms) { clearTimeout(saveT); saveT = setTimeout(flush, ms); paintSave(); }
  async function flush() {
    if (saving) return flushSoon(300);
    const ids = Object.keys(pending); if (!ids.length) return paintSave();
    saving = true; paintSave();
    for (const mid of ids) {
      const p = pending[mid]; const m = M().matches.find((x) => String(x.id) === mid); if (!m) { delete pending[mid]; continue; }
      try { await ops.score(m, p.h, p.a); if (pending[mid] === p) delete pending[mid]; if (!m.started_at) m.started_at = now(); }
      catch (e) { saving = false; paintSave(true); return flushSoon(4000); }
    }
    saving = false; paintSave();
  }
  function paintSave(err) {
    const el = document.getElementById("mx-save"); if (!el) return;
    const n = Object.keys(pending).length;
    el.className = "mx-save " + (err ? "err" : n || saving ? "wait" : "ok");
    el.textContent = err ? "⚠ ما انحفظ، يعيد المحاولة" : n || saving ? "… يحفظ" : "✓ محفوظ";
  }
  window.addEventListener("beforeunload", (e) => { if (Object.keys(pending).length) { e.preventDefault(); e.returnValue = ""; } });

  // ---- timer (lives on the referee's device)
  const TM = {};
  const tKey = (id) => "mgh.mt." + id;
  function tGet(id) {
    if (TM[id]) return TM[id];
    let t = null; try { t = JSON.parse(localStorage.getItem(tKey(id)) || "null"); } catch (e) {}
    return (TM[id] = t || { ph: "pre", run: false, t0: 0, acc: 0, extra: 0, half: 7, brk: 2, rang: false });
  }
  function tSet(id, t) { TM[id] = t; try { localStorage.setItem(tKey(id), JSON.stringify(t)); } catch (e) {} }
  const tDur = (t) => (t.ph === "h1" || t.ph === "h2" ? t.half * 60000 + (t.extra || 0) : t.ph === "ht" ? t.brk * 60000 : 0);
  const tEl = (t) => t.acc + (t.run ? Date.now() - t.t0 : 0);
  const tLeft = (t) => tDur(t) - tEl(t);
  const PH = { pre: "قبل البداية", h1: "الشوط الأول", ht: "بين الشوطين", h2: "الشوط الثاني", end: "انتهت المباراة" };

  let AC = null, wake = null;
  function audio() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) { AC = null; } return AC; }
  function whistle(n = 1) {
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(n > 1 ? [380, 140, 380, 140, 600] : [300]); } catch (e) {}
    const a = audio(); if (!a) return;
    for (let i = 0; i < n; i++) {
      const st = a.currentTime + i * 0.5, len = i === n - 1 && n > 1 ? 0.75 : 0.38;
      const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = "square"; o.frequency.value = 2850; lfo.frequency.value = 26; lg.gain.value = 160;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(a.destination);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.22, st + 0.02); g.gain.setValueAtTime(0.22, st + len - 0.05); g.gain.linearRampToValueAtTime(0, st + len);
      o.start(st); lfo.start(st); o.stop(st + len + 0.02); lfo.stop(st + len + 0.02);
    }
  }
  async function keepAwake(on) { try { if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => (wake = null)); } if (!on && wake) { await wake.release(); wake = null; } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && document.body.classList.contains("is-match")) keepAwake(true); });

  let tick = null, curMid = null;
  function startTick(mid) {
    clearInterval(tick); curMid = mid;
    tick = setInterval(() => {
      const el = document.getElementById("mx-clock"); if (!el || curMid !== mid) { clearInterval(tick); keepAwake(false); return; }
      const t = tGet(mid); const left = tLeft(t);
      el.textContent = t.ph === "pre" ? fmtClock(t.half * 60000) : t.ph === "end" ? "—" : fmtClock(left);
      const over = t.run && left <= 0 && (t.ph === "h1" || t.ph === "h2" || t.ph === "ht");
      el.classList.toggle("over", over || (t.ph !== "ht" && t.ph !== "pre" && left <= 0 && t.ph !== "end"));
      el.classList.toggle("warn", t.run && left > 0 && left <= 60000 && t.ph !== "ht");
      if (over && !t.rang) { t.rang = true; t.run = false; t.acc = tDur(t); tSet(mid, t); whistle(t.ph === "ht" ? 1 : 3); paintMatch(); }
      document.querySelectorAll("[data-fx-end]").forEach((x) => { const left2 = Number(x.dataset.fxEnd) - Date.now(); x.textContent = left2 > 0 ? "⏱ " + fmtClock(left2) : "⏱ خلص"; x.classList.toggle("done", left2 <= 0); });
    }, 250);
  }
  const FX = {}; // power-card effect countdowns: pid -> end ms

  // ---------------- views ----------------
  const teamChip = (c) => `<span class="fteam" style="${carStyle(c)}">${esc(c ? c.name : "؟")}</span>`;
  function scoreOf(m) { return m.played || m.started_at || m.home_goals != null ? `${m.home_goals ?? 0} – ${m.away_goals ?? 0}` : "ضد"; }
  function statusOf(m) { const t = tGet(m.id); return m.played ? "✓ انتهت" : t.ph === "pre" && !m.started_at ? "لم تبدأ" : t.ph === "end" ? "بانتظار الاعتماد" : "⏱ جارية"; }
  function matchRow(m, href, md) {
    const h = md.car(m.home_id), a = md.car(m.away_id);
    return `<a class="fmatch ${m.played ? "done" : ""}" href="${href}"><span class="fm-st">${statusOf(m)}${m.stage !== "league" ? " · " + (m.stage === "final" ? "النهائي" : "المركز الثالث") : ""}</span>
      <div class="fm-row">${teamChip(h)}<b class="num">${scoreOf(m)}</b>${teamChip(a)}</div><span class="fm-go">${m.played ? "افتح" : "افتح المباراة ←"}</span></a>`;
  }

  // ======== staff: الملعب ========
  function viewField() {
    const S = ctx.S(), I = ctx.I(); const md = M(); const m = md.meeting; const edit = md.edit;
    const today = m ? S.matches.filter((x) => x.meeting_id === m.id).sort((a, b) => a.round - b.round || a.id - b.id) : [];
    const anyPlayed = S.matches.some((x) => x.stage === "league" && x.played);
    const st = L.standings(S);
    const tool = (href, icon, t, s) => `<a class="ftool" href="${href}"><span>${icon}</span><b>${t}</b><small>${s}</small></a>`;
    const evToday = m ? (S.field_events || []).filter((e) => e.meeting_id === m.id) : [];
    const ptsToday = (cid) => evToday.filter((e) => e.caravan_id === cid).reduce((n, e) => n + e.points, 0);
    const rounds = [...new Set(S.matches.map((x) => x.round))].sort((a, b) => a - b);
    $app().innerHTML = ctx.shell(`
      ${ctx.pageHead("الملعب", m ? `اللقاء ${m.number} · الخميس ${ctx.fmtDate(m.meet_date)}` : "", ctx.meetPicker())}
      <div class="ftools">
        ${tool("#gather", "📣", "الجمع", "صفّر، وسجّل الأسرع والأضبط")}
        ${tool("#game", "🎯", "نقاط لعبة", "أداء + تعاون لكل قافلة")}
        ${tool("#cards", "🎴", "بطاقات القوة", "اسحب، وشوف رصيد كل قافلة")}
        ${ctx.can("plan") ? `<button class="ftool" data-f="linkopen"><span>🔗</span><b>رابط الحكم</b><small>يسجّل المباراة بدون دخول</small></button>` : ""}
      </div>
      ${ui.linkOpen ? linkPanel() : ""}
      <section class="fsec"><h2 class="h2">⚽ مباريات اليوم</h2>
        ${today.length ? `<div class="fmatches">${today.map((x) => matchRow(x, "#match/" + x.id, md)).join("")}</div><p class="muted small">ترتيب اللعب على كيفك، افتح أي مباراة وابدأ.</p>` : `<p class="muted">ما فيه مباريات في هذا اللقاء.${!anyPlayed ? " ابنِ الدوري تحت." : ""}</p>`}
      </section>
      ${evToday.length ? `<section class="fsec"><h2 class="h2">📊 نقاط الميدان اليوم</h2><div class="fpts">${S.caravans.map((c) => `<span style="${carStyle(c)}"><b>${esc(c.name)}</b><b class="num">${ptsToday(c.id)}</b></span>`).join("")}</div><p class="muted small">من الجمع والألعاب، وتنضاف لرصيد القافلة.</p></section>` : ""}
      ${edit ? builder(S, anyPlayed) : ""}
      <section class="fsec"><h2 class="h2">🏆 الترتيب</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>القافلة</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>الفارق</th><th>النقاط</th></tr></thead><tbody>${st.map((s, i) => `<tr><td class="num">${i + 1}</td><td><span class="sw" style="${carStyle(I.car[s.id])}"></span>${esc(I.car[s.id] ? I.car[s.id].name : "")}</td><td class="num">${s.p}</td><td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf - s.ga}</td><td class="num"><b>${s.pts}</b></td></tr>`).join("")}</tbody></table></div>
        <p class="muted small">فوز 3، تعادل 1، و+1 لعب نظيف يعطيه الحكم آخر المباراة.</p></section>
      <details class="panel fsec-d"><summary><h3>📅 جدول الدوري كامل</h3></summary>
        ${rounds.map((r) => { const ms = S.matches.filter((x) => x.round === r); const mt = ms[0] && I.meet[ms[0].meeting_id];
          return `<div class="fround"><h4>الجولة ${r}${ms[0] && ms[0].stage !== "league" ? " · " + (ms[0].stage === "final" ? "النهائي" : "المركز الثالث") : ""} <small class="muted">${mt ? "اللقاء " + mt.number + " · " + ctx.fmtDate(mt.meet_date) : "بدون لقاء"}</small></h4>${ms.map((x) => matchRow(x, "#match/" + x.id, md)).join("")}</div>`; }).join("") || '<p class="muted">ما فيه جدول.</p>'}
        <p><a class="btn ghost sm" href="#league">التعديل المتقدم (الحراس، لاعب الروح، الجوائز)</a></p></details>`, "field");
  }
  function builder(S, anyPlayed) {
    if (anyPlayed) return "";
    const ms = S.meetings; const todayIso = isoToday();
    const defFrom = Math.max(0, ms.findIndex((x) => x.meet_date >= todayIso));
    const b = ui.fb || { a: "", b: "", from: defFrom };
    const opt = (v) => S.caravans.map((c) => `<option value="${c.id}" ${String(c.id) === String(v) ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    const plan = ui.fbPlan;
    const I = ctx.I();
    const prev = plan ? `<div class="fb-prev">${[...new Set(plan.rows.map((r) => r.round))].map((r) => { const rs = plan.rows.filter((x) => x.round === r); const mt = I.meet[rs[0].meeting_id];
        return `<div class="fb-r"><b>الجولة ${r}</b><small class="muted">${mt ? "اللقاء " + mt.number + " · " + ctx.fmtDate(mt.meet_date) : "⚠ بدون لقاء"}</small>${rs.map((x) => `<span>${teamChip(I.car[x.home_id])} ضد ${teamChip(I.car[x.away_id])}</span>`).join("")}</div>`; }).join("")}</div>
      ${plan.short ? `<p class="alert">${plan.short} جولة ما لها لقاء (اللقاء الأخير محجوز للنهائي). أضف لقاءات أو ابدأ من لقاء أبكر.</p>` : ""}
      <p class="muted small">كل قافلتين يتقابلون مرة في الذهاب ومرة في الإياب، وما يتكرر لقاء قبل ما تخلص كل التوافيق. بعد آخر جولة تضيف النهائي من الترتيب.</p>
      <div class="row-btns"><button class="btn" data-f="fbapply">اعتمد الجدول</button><button class="btn ghost" data-f="fbcancel">إلغاء</button></div>` : "";
    const old = S.matches.filter((x) => x.stage === "league").length;
    let built = false; try { built = localStorage.getItem("mgh.leagueBuilt") === "1"; } catch (e) {}
    return `<details class="panel fsec-d" ${ui.fb || plan || !built ? "open" : ""}><summary><h3>🧩 بناء الدوري</h3></summary>
      <p class="muted small">اختر أول مباراة (مثلًا أول قافلتين انضبطوا في الجمع)، والمنصة تكمل باقي الجولات تلقائيًا بدون تكرار.${old ? ` <b>يمسح الجدول الحالي (${old} مباراة) لأن ما انلعب منه شي.</b>` : ""}</p>
      <div class="fb-pick"><label>القافلة الأولى<select id="fb-a"><option value="">—</option>${opt(b.a)}</select></label><span class="vs">ضد</span><label>القافلة الثانية<select id="fb-b"><option value="">—</option>${opt(b.b)}</select></label>
        <label>تبدأ من<select id="fb-from">${ms.map((x, i) => `<option value="${i}" ${i === Number(b.from) ? "selected" : ""}>اللقاء ${x.number} · ${ctx.fmtDate(x.meet_date)}</option>`).join("")}</select></label></div>
      <div class="row-btns"><button class="btn ghost sm" data-f="fbrand">🎲 قرعة أول مباراة</button><button class="btn sm" data-f="fbrun">اعرض الجدول</button></div>${prev}</details>`;
  }
  function linkPanel() {
    const t = ((ctx.S().app_settings || []).find((x) => x.key === "field_token") || {}).value;
    const url = t ? location.origin + location.pathname + "#f/" + t : "";
    return `<section class="panel flink"><h3>🔗 رابط الحكم</h3>
      <p class="small">يفتح على أي جوال بدون دخول، ويسجّل <b>مباريات اللقاء فقط</b>: الوقت والأهداف والبطاقات وبطاقات القوة والنتيجة. ما يشوف النقاط ولا الملاحظات ولا أي شي ثاني.</p>
      ${url ? `<div class="flink-u"><code dir="ltr">${esc(url)}</code><button class="btn sm" data-f="linkcopy" data-v="${esc(url)}">نسخ</button></div>` : '<p class="alert">ما فيه رابط بعد.</p>'}
      <p class="muted small">إذا وصل الرابط لأحد ما تبيه، غيّره، والقديم يوقف فورًا.</p>
      <div class="row-btns"><button class="btn ghost sm" data-f="linknew">${url ? "غيّر الرابط" : "أنشئ رابط"}</button><button class="btn ghost sm" data-f="linkopen">إخفاء</button></div></section>`;
  }

  // ======== match screen (staff + referee link) ========
  function viewMatch(mid, back) {
    const md = M(); const m = md.matches.find((x) => String(x.id) === String(mid));
    document.body.classList.add("is-match");
    if (!m) { $app().innerHTML = `<div class="mx"><div class="mx-top"><a class="mx-back" href="${back}">→ رجوع</a></div><p class="empty">المباراة غير موجودة.</p></div>`; return; }
    curMid = m.id; ui.back = back;
    paintMatch();
    startTick(m.id);
    const t = tGet(m.id); if (t.run) keepAwake(true);
  }
  function side(m, md, s) {
    const cid = s === "h" ? m.home_id : m.away_id; const c = md.car(cid);
    const sc = s === "h" ? m.home_goals ?? 0 : m.away_goals ?? 0;
    const gl = md.goals.filter((g) => g.match_id === m.id && md.kid(g.kid_id) && md.kid(g.kid_id).caravan_id === cid);
    const cd = md.cards.filter((x) => x.match_id === m.id && md.kid(x.kid_id) && md.kid(x.kid_id).caravan_id === cid);
    const played = md.power.filter((p) => p.used_match_id === m.id && p.caravan_id === cid);
    const free = md.power.filter((p) => p.caravan_id === cid && !p.used_match_id && !p.used_at);
    const golden = played.some((p) => p.kind === "golden");
    const ed = md.edit && !m.played;
    const cardIc = { yellow: "🟨", red: "🟥", blue: "🟦" };
    return `<section class="mx-side" style="${carStyle(c)}">
      <h2 class="mx-name">${esc(c ? c.name : "؟")}</h2>
      <div class="mx-score num" aria-live="polite">${sc}</div>
      ${ed ? `<div class="mx-goal"><button class="mx-plus" data-f="goal" data-s="${s}" data-n="1">+ هدف</button>${golden ? `<button class="mx-plus gold" data-f="goal" data-s="${s}" data-n="2">⚡ +2</button>` : ""}<button class="mx-minus" data-f="goal" data-s="${s}" data-n="-1" aria-label="ألغِ هدف">−</button></div>` : ""}
      ${gl.length ? `<p class="mx-list">⚽ ${gl.map((g) => `<span>${esc(md.kid(g.kid_id).first_name)}${ed ? `<button class="x" data-f="goaldel" data-id="${g.id}" aria-label="احذف المسجّل">×</button>` : ""}</span>`).join("")}</p>` : ""}
      ${ed ? `<div class="mx-cards">${["yellow", "red", "blue"].map((col) => `<button class="mx-cb ${col}" data-f="cardpick" data-s="${s}" data-c="${col}" aria-label="بطاقة ${col === "yellow" ? "صفراء" : col === "red" ? "حمراء" : "زرقاء للأمانة"}">${cardIc[col]}</button>`).join("")}</div>` : ""}
      ${cd.length ? `<p class="mx-list">${cd.map((x) => `<span>${cardIc[x.color]} ${x.kid_id && md.kid(x.kid_id) ? esc(md.kid(x.kid_id).first_name) : "بدون اسم"}${ed ? `<button class="x" data-f="carddel" data-id="${x.id}" aria-label="احذف البطاقة">×</button>` : ""}</span>`).join("")}</p>` : ""}
      <div class="mx-pw">
        ${played.map((p) => { const P = L.POWER[p.kind] || {}; const timed = /دقيقت/.test(P.dur || "");
          return `<div class="mx-fx t${P.tier}"><b>${P.icon || "🎴"} ${esc(P.name || p.kind)}</b><small>${esc(P.rule || "")}</small>${timed && ed ? (FX[p.id] ? `<span class="mx-fxt" data-fx-end="${FX[p.id]}">⏱</span>` : `<button class="chip" data-f="fxgo" data-id="${p.id}">⏱ شغّل الدقيقتين</button>`) : ""}${ed ? `<button class="x" data-f="pwback" data-id="${p.id}" aria-label="رجّع البطاقة">↩︎</button>` : ""}</div>`; }).join("")}
        ${ed ? (free.length ? `<button class="mx-pwbtn" data-f="pwpick" data-s="${s}">🎴 لعب بطاقة قوة <b class="num">${free.length}</b></button>` : `<small class="muted">ما عندها بطاقات قوة</small>`) : ""}
      </div>
    </section>`;
  }
  function paintMatch() {
    const md = M(); const m = md.matches.find((x) => x.id === curMid); if (!m) return;
    const t = tGet(m.id); const h = md.car(m.home_id), a = md.car(m.away_id); const ed = md.edit;
    const left = tLeft(t);
    let ctrl = "";
    if (!m.played && ed) {
      if (t.ph === "pre") ctrl = `<button class="mx-btn go" data-f="tgo">▶ ابدأ الشوط الأول</button>`;
      else if (t.ph === "ht") ctrl = `<button class="mx-btn go" data-f="tgo">▶ ابدأ الشوط الثاني</button>`;
      else if (t.ph === "h1" || t.ph === "h2") ctrl = (left <= 0 ? "" : t.run ? `<button class="mx-btn" data-f="tpause">⏸ إيقاف مؤقت</button>` : `<button class="mx-btn go" data-f="tresume">▶ كمّل</button>`)
        + `<button class="mx-btn" data-f="tplus">+1 د</button><button class="mx-btn ${left <= 0 ? "go" : ""}" data-f="tend">${t.ph === "h1" ? "⏭ إنهاء الشوط" : "🏁 نهاية المباراة"}</button>`;
      ctrl += `<button class="mx-btn ic" data-f="whistle" aria-label="صافرة">📢</button>`;
    }
    const coin = ui.coin[m.id];
    const pick = ui.pick && ui.pick.mid === m.id ? sheet(m, md) : "";
    const fin = (t.ph === "end" || ui.finish === m.id) && !m.played && ed;
    $app().innerHTML = `<div class="mx ${m.played ? "played" : ""}">
      <header class="mx-top"><a class="mx-back" href="${ui.back}">→ رجوع</a><span class="mx-round">${m.stage === "final" ? "النهائي" : m.stage === "third" ? "المركز الثالث" : "الجولة " + m.round}</span><span id="mx-save" class="mx-save ok">✓ محفوظ</span></header>
      <div class="mx-clockbox"><small class="mx-ph">${m.played ? "✓ النتيجة معتمدة" : PH[t.ph]}${t.extra && (t.ph === "h1" || t.ph === "h2") ? ` · +${Math.round(t.extra / 60000)} د` : ""}</small>
        <div id="mx-clock" class="mx-clock num">${t.ph === "pre" ? fmtClock(t.half * 60000) : t.ph === "end" ? "—" : fmtClock(left)}</div>
        ${left <= 0 && (t.ph === "h1" || t.ph === "h2") && !m.played ? `<p class="mx-over">انتهى الوقت</p>` : ""}
        <div class="mx-ctrl">${ctrl}</div>
        ${t.ph === "pre" && !m.played && ed ? `<div class="mx-pre"><label>مدة الشوط <select data-f="thalf">${[5, 6, 7, 8, 10].map((n) => `<option value="${n}" ${t.half === n ? "selected" : ""}>${n} د</option>`).join("")}</select></label>
          <button class="chip" data-f="coin">🪙 قرعة البداية</button>${coin ? `<b class="mx-coin" style="${carStyle(md.car(coin))}">${esc(md.car(coin).name)} تختار الجهة أو ضربة البداية</b>` : ""}</div>` : ""}
      </div>
      <div class="mx-board">${side(m, md, "h")}<div class="mx-vs">ضد</div>${side(m, md, "a")}</div>
      ${fin ? finishPanel(m, md) : ""}
      ${m.played ? `<div class="mx-done"><p>النتيجة النهائية: <b>${esc(h.name)} ${m.home_goals ?? 0} – ${m.away_goals ?? 0} ${esc(a.name)}</b>${m.fair_home || m.fair_away ? ` · لعب نظيف: ${[m.fair_home ? h.name : null, m.fair_away ? a.name : null].filter(Boolean).map(esc).join("، ")}` : ""}</p>${ed ? `<button class="btn ghost sm" data-f="reopen">فتح للتعديل</button>` : ""}</div>`
        : ed && !fin ? `<div class="mx-foot"><button class="btn ghost sm" data-f="finopen">🏁 اعتمد النتيجة الحين</button>${t.ph !== "pre" ? `<button class="btn ghost sm" data-f="treset">↺ صفّر الوقت</button>` : ""}</div>` : ""}
      ${pick}
    </div>`;
    paintSave();
  }
  function finishPanel(m, md) {
    const h = md.car(m.home_id), a = md.car(m.away_id); const f = ui.fair || {};
    return `<section class="mx-fin"><h3>🏁 اعتماد النتيجة</h3><p class="mx-final num">${esc(h.name)} <b>${m.home_goals ?? 0} – ${m.away_goals ?? 0}</b> ${esc(a.name)}</p>
      <p class="small">لعب نظيف (+1): القافلة اللي ما اعترضت وما تعمّدت الخشونة.</p>
      <div class="mx-fair"><button class="chip" data-f="fair" data-s="h" aria-pressed="${!!f.h}" style="${carStyle(h)}">${f.h ? "✓ " : ""}${esc(h.name)}</button><button class="chip" data-f="fair" data-s="a" aria-pressed="${!!f.a}" style="${carStyle(a)}">${f.a ? "✓ " : ""}${esc(a.name)}</button></div>
      <div class="row-btns"><button class="btn" data-f="finsave">اعتمد النتيجة</button><button class="btn ghost" data-f="fincancel">رجوع للمباراة</button></div></section>`;
  }
  function sheet(m, md) {
    const p = ui.pick; const cid = p.s === "h" ? m.home_id : m.away_id; const c = md.car(cid);
    const kids = md.kidsOf(cid);
    if (p.type === "goal") return `<div class="mx-sheet" style="${carStyle(c)}"><div class="mx-sh-in"><h3>⚽ هدف لـ${esc(c.name)}! مين سجّل؟</h3><div class="mx-kids">${kids.map((k) => `<button data-f="scorer" data-k="${k.id}">${esc(k.first_name)}</button>`).join("")}</div><button class="btn ghost" data-f="pickclose">تخطي</button></div></div>`;
    if (p.type === "card") { const nm = { yellow: "🟨 صفراء", red: "🟥 حمراء", blue: "🟦 زرقاء للأمانة" }[p.c];
      return `<div class="mx-sheet" style="${carStyle(c)}"><div class="mx-sh-in"><h3>${nm} · ${esc(c.name)}: لمين؟</h3><div class="mx-kids">${kids.map((k) => `<button data-f="cardkid" data-k="${k.id}">${esc(k.first_name)}</button>`).join("")}</div><button class="btn ghost" data-f="pickclose">إلغاء</button></div></div>`; }
    if (p.type === "power") { const free = md.power.filter((x) => x.caravan_id === cid && !x.used_match_id && !x.used_at);
      const sel = p.pid ? md.power.find((x) => x.id === p.pid) : null;
      if (sel) { const P = L.POWER[sel.kind]; return `<div class="mx-sheet" style="${carStyle(c)}"><div class="mx-sh-in"><h3>${P.icon} ${esc(P.name)}</h3><p class="mx-rule">${esc(P.rule)}</p><p class="muted small">${esc(P.when)} · ${esc(P.dur)}</p><div class="row-btns"><button class="btn" data-f="pwplay" data-id="${sel.id}">لعبوها ✓</button><button class="btn ghost" data-f="pickclose">إلغاء</button></div></div></div>`; }
      return `<div class="mx-sheet" style="${carStyle(c)}"><div class="mx-sh-in"><h3>🎴 بطاقات ${esc(c.name)}</h3><p class="muted small">الكابتن يعلن البطاقة ويسلّمك الورقة. بطاقة وحدة بالمباراة، والتعطيل والمرآة تنلعب ردًّا.</p><div class="mx-pwlist">${free.map((x) => { const P = L.POWER[x.kind]; return `<button class="t${P.tier}" data-f="pwsel" data-id="${x.id}"><b>${P.icon} ${esc(P.name)}</b><small>${esc(P.hit)}</small></button>`; }).join("")}</div><button class="btn ghost" data-f="pickclose">إلغاء</button></div></div>`; }
    return "";
  }

  // ======== الجمع ========
  function viewGather() {
    const S = ctx.S(), I = ctx.I(); const m = I.meet[ctx.meetId()]; const ed = ctx.can("points");
    const g = ui.gather; const evs = m ? (S.field_events || []).filter((e) => e.meeting_id === m.id && (e.kind === "gather" || e.kind === "late")) : [];
    const groups = [...new Set(evs.map((e) => e.game))];
    let body;
    if (!m) body = '<p class="empty">اختر لقاء.</p>';
    else if (!g) body = `<div class="ga-start"><button class="ga-big" data-f="gstart" ${ed ? "" : "disabled"}>📢 صفّر للجمع</button><p class="muted">تضغط وتصفّر بنفس اللحظة، وبعدها تضغط على كل قافلة أول ما توصل وتنتظم في صفها.</p></div>`;
    else {
      const left = S.caravans.filter((c) => !g.order.some((o) => o.cid === c.id));
      body = `<div class="ga-run"><div class="ga-clock num" id="ga-clock">${fmtClock(Date.now() - g.t0)}</div>
        <div class="ga-cars">${left.map((c) => `<button class="ga-car" style="${carStyle(c)}" data-f="garrive" data-car="${c.id}">${esc(c.name)}<small>وصلت وانتظمت</small></button>`).join("") || '<p class="muted">كل القوافل وصلت.</p>'}</div>
        ${g.order.length ? `<ol class="ga-order">${g.order.map((o, i) => { const c = I.car[o.cid]; const pts = o.ok ? GATHER_PTS[i] || 0 : 0;
          return `<li style="${carStyle(c)}"><span class="ga-rank num">${i + 1}</span><b>${esc(c.name)}</b><small class="num">${o.sec} ث</small>
            <button class="chip" data-f="gok" data-i="${i}" aria-pressed="${o.ok}">${o.ok ? "✓ منضبطة" : "✗ غير منضبطة"}</button><b class="num ga-pts">+${pts}</b>
            ${o.ok ? "" : `<input class="ga-note" data-i="${i}" placeholder="مين وليش؟ (اختياري)" maxlength="80" value="${esc(o.note || "")}">`}</li>`; }).join("")}</ol>` : ""}
        <p class="muted small">النقاط: الأولى ${GATHER_PTS[0]}، الثانية ${GATHER_PTS[1]}، الثالثة ${GATHER_PTS[2]}. اللي ما انتظمت ما تاخذ نقاط وتنسجّل.</p>
        <div class="row-btns"><button class="btn" data-f="gsave" ${g.order.length ? "" : "disabled"}>اعتمد الجمع</button><button class="btn ghost" data-f="gcancel">إلغاء</button></div></div>`;
    }
    const firstTwo = groups.length ? evs.filter((e) => e.game === groups[0] && e.kind === "gather" && e.points > 0).sort((a, b) => b.points - a.points).slice(0, 2) : [];
    const canBuild = ctx.can("league") && !S.matches.some((x) => x.stage === "league" && x.played) && firstTwo.length === 2;
    const hist = groups.map((gname) => { const xs = evs.filter((e) => e.game === gname);
      return `<li><b>${esc(gname)}</b> ${xs.filter((e) => e.kind === "gather").sort((a, b) => b.points - a.points).map((e) => `<span style="${carStyle(I.car[e.caravan_id])}" class="fteam">${esc(I.car[e.caravan_id] ? I.car[e.caravan_id].name : "")} +${e.points}</span>`).join(" ")}
        ${xs.filter((e) => e.kind === "late").map((e) => `<small class="ga-late">✗ ${esc(I.car[e.caravan_id] ? I.car[e.caravan_id].name : "")}${e.note ? ": " + esc(e.note) : ""}</small>`).join(" ")}
        ${ed ? `<button class="x" data-f="gdel" data-g="${esc(gname)}" aria-label="احذف">×</button>` : ""}</li>`; }).join("");
    $app().innerHTML = ctx.shell(`<a class="back" href="#field">→ الملعب</a>
      ${ctx.pageHead("📣 الجمع", "الأسرع والأضبط ياخذ النقاط.", ctx.meetPicker())}
      <section class="panel">${body}</section>
      ${hist ? `<section class="panel"><h3>جمع اليوم</h3><ul class="ga-hist">${hist}</ul>
        ${canBuild ? `<p class="small">أول قافلتين في «${esc(groups[0])}»: ${firstTwo.map((e) => esc(I.car[e.caravan_id].name)).join(" و")}.</p><button class="btn sm" data-f="gbuild" data-a="${firstTwo[0].caravan_id}" data-b="${firstTwo[1].caravan_id}">⚽ خلّهم أول مباراة وابنِ الدوري</button>` : ""}</section>` : ""}`, "gather");
    if (g) { clearInterval(ui.gT); ui.gT = setInterval(() => { const el = document.getElementById("ga-clock"); if (!el || !ui.gather) return clearInterval(ui.gT); el.textContent = fmtClock(Date.now() - ui.gather.t0); }, 250); }
  }

  // ======== نقاط لعبة ========
  function viewGame() {
    const S = ctx.S(), I = ctx.I(); const m = I.meet[ctx.meetId()]; const ed = ctx.can("points");
    const g = ui.game || (ui.game = { name: "", v: {} });
    const evs = m ? (S.field_events || []).filter((e) => e.meeting_id === m.id && (e.kind === "game_perf" || e.kind === "game_coop")) : [];
    const games = [...new Set(evs.map((e) => e.game))];
    const step = (cid, k) => { const v = (g.v[cid] || {})[k] || 0; return `<div class="gm-step"><button class="step" data-f="gstep" data-car="${cid}" data-k="${k}" data-d="-1" aria-label="نقص">−</button><output class="num">${v}</output><button class="step" data-f="gstep" data-car="${cid}" data-k="${k}" data-d="1" aria-label="زد">+</button><small class="muted">من ${GAME_MAX[k]}</small></div>`; };
    $app().innerHTML = ctx.shell(`<a class="back" href="#field">→ الملعب</a>
      ${ctx.pageHead("🎯 نقاط لعبة", "لكل قافلة: أداء من 7، وتعاون وروح رياضية من 3. كذا التعاون 30% من النقاط دايمًا.", ctx.meetPicker())}
      ${ed && m ? `<section class="panel"><label>اسم اللعبة<input id="gm-name" maxlength="40" placeholder="مثال: جسر الأنابيب" value="${esc(g.name)}"></label>
        <div class="gm-grid">${S.caravans.map((c) => `<div class="gm-car" style="${carStyle(c)}"><h3>${esc(c.name)}</h3><div class="gm-row"><span>🏃 الأداء</span>${step(c.id, "perf")}</div><div class="gm-row"><span>🤝 التعاون</span>${step(c.id, "coop")}</div><b class="gm-tot num">${((g.v[c.id] || {}).perf || 0) + ((g.v[c.id] || {}).coop || 0)}</b></div>`).join("")}</div>
        <div class="row-btns"><button class="btn" data-f="gmsave">احفظ نقاط اللعبة</button><button class="btn ghost" data-f="gmreset">تصفير</button></div></section>` : ""}
      ${games.length ? `<section class="panel"><h3>ألعاب اليوم</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>اللعبة</th>${S.caravans.map((c) => `<th><span class="sw" style="${carStyle(c)}"></span>${esc(c.name)}</th>`).join("")}${ed ? "<th></th>" : ""}</tr></thead><tbody>
        ${games.map((gn) => `<tr><td>${esc(gn)}</td>${S.caravans.map((c) => { const xs = evs.filter((e) => e.game === gn && e.caravan_id === c.id); const p = xs.filter((e) => e.kind === "game_perf").reduce((n, e) => n + e.points, 0), q = xs.filter((e) => e.kind === "game_coop").reduce((n, e) => n + e.points, 0); return `<td class="num">${p + q} <small class="muted">(${p}+${q})</small></td>`; }).join("")}${ed ? `<td><button class="x" data-f="gmdel" data-g="${esc(gn)}" aria-label="احذف">×</button></td>` : ""}</tr>`).join("")}
      </tbody></table></div></section>` : ""}`, "game");
  }

  // ======== referee link ========
  async function viewLink(token, mid) {
    mode = "field"; tok = token; document.body.classList.add("is-match");
    if (!FS || FS._tok !== token) {
      $app().innerHTML = `<div class="mx"><p class="empty">جاري التحميل…</p></div>`;
      try { FS = await T("field_state", {}); FS._tok = token; FSerr = null; } catch (e) { FSerr = e; }
    }
    if (FSerr) { $app().innerHTML = `<div class="mx"><div class="mx-link-err"><img src="assets/mahara.png" alt="نادي مهارة"><h1>الرابط ما يشتغل</h1><p>يمكن تغيّر أو انتهى. اطلب الرابط الجديد من مسؤول الفئة.</p></div></div>`; return; }
    if (mid) return viewMatch(mid, "#f/" + token);
    const md = M(); const mt = md.meeting;
    $app().innerHTML = `<div class="mx"><header class="mx-top"><img class="mx-logo" src="assets/mahara.png" alt="نادي مهارة"><span class="mx-round">رابط الحكم${mt ? ` · اللقاء ${mt.number} · ${mt.meet_date}` : ""}</span><button class="mx-back" data-f="lrefresh">↻ تحديث</button></header>
      <div class="fmatches lnk">${md.matches.map((x) => matchRow(x, "#f/" + token + "/" + x.id, md)).join("") || '<p class="empty">ما فيه مباريات اليوم.</p>'}</div>
      <p class="muted small mx-note">اختر المباراة وابدأ الوقت. كل شي ينحفظ أول بأول.</p></div>`;
  }

  // ---------------- events ----------------
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "fb-a" || t.id === "fb-b" || t.id === "fb-from") { ui.fb = { a: document.getElementById("fb-a").value, b: document.getElementById("fb-b").value, from: Number(document.getElementById("fb-from").value) }; ui.fbPlan = null; return; }
    if (t.dataset && t.dataset.f === "thalf") { const tt = tGet(curMid); tt.half = Number(t.value); tSet(curMid, tt); return paintMatch(); }
    if (t.classList && t.classList.contains("ga-note") && ui.gather) { ui.gather.order[Number(t.dataset.i)].note = t.value.trim(); }
    if (t.id === "gm-name" && ui.game) ui.game.name = t.value.trim();
  });
  document.addEventListener("input", (e) => { const t = e.target; if (t.id === "gm-name" && ui.game) ui.game.name = t.value.trim(); if (t.classList && t.classList.contains("ga-note") && ui.gather) ui.gather.order[Number(t.dataset.i)].note = t.value.trim(); });

  const busy = new Set();
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-f]"); if (!b || b.tagName === "SELECT") return;
    const f = b.dataset.f; const key = f + JSON.stringify(b.dataset);
    if (busy.has(key)) return; busy.add(key); setTimeout(() => busy.delete(key), f === "gstep" ? 0 : f === "goal" ? 90 : 450);
    const md = M(); const m = md.matches.find((x) => x.id === curMid);
    const arm = (label, ms = 3000) => { if (ui.armed === key) return true; ui.armed = key; b.textContent = label; setTimeout(() => { if (ui.armed === key) ui.armed = null; }, ms); return false; };
    switch (f) {
      // --- builder
      case "fbrand": { const ids = ctx.S().caravans.map((c) => c.id); const r = crypto.getRandomValues(new Uint32Array(2)); const a = ids[r[0] % ids.length]; const rest = ids.filter((x) => x !== a); ui.fb = { ...(ui.fb || { from: Number(document.getElementById("fb-from").value) }), a: String(a), b: String(rest[r[1] % rest.length]) }; ui.fbPlan = null; return viewField(); }
      case "fbrun": { const S = ctx.S(); const fb = ui.fb || { a: document.getElementById("fb-a").value, b: document.getElementById("fb-b").value, from: Number(document.getElementById("fb-from").value) }; ui.fb = fb;
        if (!fb.a || !fb.b || fb.a === fb.b) { toast("اختر قافلتين مختلفتين لأول مباراة.", "err"); return; }
        const rounds = leagueRounds(S.caravans.map((c) => c.id), [Number(fb.a), Number(fb.b)]); ui.fbPlan = planSchedule(S.meetings, Number(fb.from), rounds); return viewField(); }
      case "fbcancel": ui.fb = null; ui.fbPlan = null; return viewField();
      case "fbapply": { const S = ctx.S(); const plan = ui.fbPlan; if (!plan) return;
        if (S.matches.some((x) => x.stage === "league" && x.played)) return toast("فيه مباريات انلعبت، عدّل الجدول من التعديل المتقدم.", "err");
        const old = S.matches.filter((x) => x.stage === "league").map(({ id, round, stage, meeting_id, home_id, away_id }) => ({ id, round, stage, meeting_id, home_id, away_id }));
        ui.fb = null; ui.fbPlan = null; try { localStorage.setItem("mgh.leagueBuilt", "1"); } catch (e) {}
        return ctx.doUndoable(`انبنى الدوري: ${plan.rows.length} مباراة`, async () => { for (const x of old) await db.remove("matches", { id: x.id }); return db.insert("matches", plan.rows); },
          async (ins) => { for (const x of ins || []) await db.remove("matches", { id: x.id }); if (old.length) await db.insert("matches", old.map(({ id, ...r }) => r)); }, ["matches", "goals", "cards", "power_cards"]); }
      case "linkopen": ui.linkOpen = !ui.linkOpen; return viewField();
      case "linkcopy": try { await navigator.clipboard.writeText(b.dataset.v); toast("نُسخ الرابط ✓"); } catch (x) { toast("انسخه يدويًا من فوق", "err"); } return;
      case "linknew": { if (!arm("متأكد؟ الرابط القديم يوقف")) return; const r = crypto.getRandomValues(new Uint8Array(32)); const v = [...r].map((x) => x.toString(16).padStart(2, "0")).join("");
        const ok = await run(() => db.upsert("app_settings", [{ key: "field_token", value: v }], "key"), ["app_settings"], "تغيّر الرابط"); if (ok) viewField(); return; }

      // --- timer
      case "tgo": { if (!m) return; audio(); const t = tGet(m.id); t.ph = t.ph === "pre" ? "h1" : t.ph === "ht" ? "h2" : t.ph; t.acc = 0; t.extra = 0; t.run = true; t.t0 = Date.now(); t.rang = false; tSet(m.id, t); whistle(1); keepAwake(true);
        if (!m.started_at) setScore(m, m.home_goals ?? 0, m.away_goals ?? 0); return paintMatch(); }
      case "tpause": { const t = tGet(m.id); t.acc = tEl(t); t.run = false; tSet(m.id, t); return paintMatch(); }
      case "tresume": { audio(); const t = tGet(m.id); t.run = true; t.t0 = Date.now(); tSet(m.id, t); whistle(1); return paintMatch(); }
      case "tplus": { const t = tGet(m.id); if (tLeft(t) <= 0) { t.acc = tEl(t); t.run = true; t.t0 = Date.now(); } t.extra = (t.extra || 0) + 60000; t.rang = false; tSet(m.id, t); return paintMatch(); }
      case "tend": { const t = tGet(m.id); whistle(3); if (t.ph === "h1") { Object.assign(t, { ph: "ht", acc: 0, run: true, t0: Date.now(), rang: false }); } else { Object.assign(t, { ph: "end", run: false }); ui.fair = {}; keepAwake(false); } tSet(m.id, t); return paintMatch(); }
      case "treset": { if (!arm("متأكد؟")) return; tSet(m.id, { ph: "pre", run: false, t0: 0, acc: 0, extra: 0, half: tGet(m.id).half, brk: 2, rang: false }); return paintMatch(); }
      case "whistle": audio(); return whistle(1);
      case "coin": { const r = crypto.getRandomValues(new Uint32Array(1))[0] % 2; ui.coin[m.id] = r ? m.away_id : m.home_id; whistle(1); return paintMatch(); }

      // --- score
      case "goal": { if (!m || m.played) return; const n = Number(b.dataset.n); const s = b.dataset.s;
        const h = (m.home_goals ?? 0) + (s === "h" ? n : 0), a = (m.away_goals ?? 0) + (s === "a" ? n : 0); if (h < 0 || a < 0) return;
        setScore(m, h, a); if (n > 0) { ui.pick = { type: "goal", s, mid: m.id }; clearTimeout(ui.pickT); ui.pickT = setTimeout(() => { if (ui.pick && ui.pick.type === "goal") { ui.pick = null; if (document.querySelector(".mx-sheet")) paintMatch(); } }, 12000); }
        return paintMatch(); }
      case "scorer": { const p = ui.pick; ui.pick = null; paintMatch(); if (!p) return; await run(() => ops.goalAdd(p.mid, b.dataset.k), ["goals"]); return paintMatch(); }
      case "goaldel": { await run(() => ops.goalDel(b.dataset.id), ["goals"], "انحذف اسم المسجّل"); return paintMatch(); }
      case "pickclose": ui.pick = null; return paintMatch();
      // --- cards
      case "cardpick": ui.pick = { type: "card", s: b.dataset.s, c: b.dataset.c, mid: m.id }; return paintMatch();
      case "cardkid": { const p = ui.pick; ui.pick = null; paintMatch(); await run(() => ops.cardAdd(p.mid, b.dataset.k, p.c, ""), ["cards"], p.c === "blue" ? "🟦 بطاقة أمانة" : p.c === "yellow" ? "🟨 سُجّلت" : "🟥 سُجّلت"); return paintMatch(); }
      case "carddel": { await run(() => ops.cardDel(b.dataset.id), ["cards"], "انحذفت البطاقة"); return paintMatch(); }
      // --- power cards
      case "pwpick": ui.pick = { type: "power", s: b.dataset.s, mid: m.id }; return paintMatch();
      case "pwsel": { const p = md.power.find((x) => String(x.id) === b.dataset.id); const cid = ui.pick.s === "h" ? m.home_id : m.away_id;
        const mine = md.power.filter((x) => x.used_match_id === m.id && x.caravan_id === cid);
        if (!RESPONSE(p.kind) && mine.some((x) => !RESPONSE(x.kind))) { toast("القافلة لعبت بطاقة بهذي المباراة. بطاقة وحدة بس (غير التعطيل والمرآة).", "err"); return; }
        ui.pick.pid = p.id; return paintMatch(); }
      case "pwplay": { const pid = Number(b.dataset.id); ui.pick = null; paintMatch(); await run(() => ops.power(pid, m.id), ["power_cards"], "🎴 انلعبت البطاقة، خذ الورقة من الكابتن"); return paintMatch(); }
      case "pwback": { if (!arm("↩︎؟")) return; const pid = Number(b.dataset.id); delete FX[pid]; await run(() => ops.power(pid, null), ["power_cards"], "رجعت البطاقة للقافلة"); return paintMatch(); }
      case "fxgo": FX[Number(b.dataset.id)] = Date.now() + 120000; whistle(1); return paintMatch();
      // --- finish
      case "finopen": ui.finish = m.id; ui.fair = {}; return paintMatch();
      case "fincancel": { ui.finish = null; const t = tGet(m.id); if (t.ph === "end") { t.ph = "h2"; t.run = false; tSet(m.id, t); } return paintMatch(); }
      case "fair": ui.fair = { ...(ui.fair || {}), [b.dataset.s]: !(ui.fair || {})[b.dataset.s] }; return paintMatch();
      case "finsave": { clearTimeout(saveT); delete pending[m.id]; const fh = !!(ui.fair || {}).h, fa = !!(ui.fair || {}).a;
        const ok = await run(() => ops.finish(m, m.home_goals ?? 0, m.away_goals ?? 0, fh, fa), ["matches"], "✓ اعتُمدت النتيجة");
        if (ok) { ui.finish = null; const t = tGet(m.id); t.ph = "end"; t.run = false; tSet(m.id, t); keepAwake(false); } return paintMatch(); }
      case "reopen": { if (!arm("متأكد؟")) return; await run(() => ops.reopen(m), ["matches"], "انفتحت للتعديل"); return paintMatch(); }
      case "lrefresh": FS = null; return viewLink(tok, null);

      // --- gather
      case "gstart": audio(); whistle(2); ui.gather = { t0: Date.now(), order: [] }; return viewGather();
      case "garrive": { const g = ui.gather; if (!g) return; g.order.push({ cid: Number(b.dataset.car), sec: Math.round((Date.now() - g.t0) / 1000), ok: true, note: "" }); return viewGather(); }
      case "gok": { const o = ui.gather.order[Number(b.dataset.i)]; o.ok = !o.ok; return viewGather(); }
      case "gcancel": if (!arm("متأكد؟")) return; ui.gather = null; return viewGather();
      case "gsave": { const g = ui.gather; const S = ctx.S(), mid = ctx.meetId(); const n = new Set((S.field_events || []).filter((x) => x.meeting_id === mid && x.kind === "gather").map((x) => x.game)).size + 1;
        const name = "الجمع " + n; let rank = 0;
        const rows = g.order.map((o) => { const pts = o.ok ? GATHER_PTS[rank] || 0 : 0; if (o.ok) rank++; return o.ok ? { meeting_id: mid, caravan_id: o.cid, kind: "gather", game: name, points: pts, note: `${o.sec} ث` } : { meeting_id: mid, caravan_id: o.cid, kind: "late", game: name, points: 0, note: o.note || null }; });
        S.caravans.filter((c) => !g.order.some((o) => o.cid === c.id)).forEach((c) => rows.push({ meeting_id: mid, caravan_id: c.id, kind: "late", game: name, points: 0, note: "ما وصلت" }));
        ui.gather = null;
        return ctx.doUndoable(`انحفظ ${name}`, () => db.insert("field_events", rows), async (r) => { for (const x of r || []) await db.remove("field_events", { id: x.id }); }, ["field_events"]); }
      case "gdel": { if (!arm("احذف؟")) return; const xs = (ctx.S().field_events || []).filter((x) => x.meeting_id === ctx.meetId() && x.game === b.dataset.g && (x.kind === "gather" || x.kind === "late"));
        return ctx.doUndoable("انحذف", async () => { for (const x of xs) await db.remove("field_events", { id: x.id }); return xs; }, async (r) => { await db.insert("field_events", r.map(({ id, created_at, ...x }) => x)); }, ["field_events"]); }
      case "gbuild": ui.fb = { a: b.dataset.a, b: b.dataset.b, from: Math.max(0, ctx.S().meetings.findIndex((x) => x.id === ctx.meetId())) }; { const S = ctx.S(); ui.fbPlan = planSchedule(S.meetings, ui.fb.from, leagueRounds(S.caravans.map((c) => c.id), [Number(b.dataset.a), Number(b.dataset.b)])); } location.hash = "field"; return;

      // --- game points
      case "gstep": { const g = ui.game; const cid = b.dataset.car, k = b.dataset.k; const o = (g.v[cid] ||= { perf: 0, coop: 0 }); o[k] = Math.max(0, Math.min(GAME_MAX[k], (o[k] || 0) + Number(b.dataset.d))); return viewGame(); }
      case "gmreset": ui.game = { name: "", v: {} }; return viewGame();
      case "gmsave": { const g = ui.game; const S = ctx.S(), mid = ctx.meetId(); const nm = g.name || "لعبة " + (new Set((S.field_events || []).filter((x) => x.meeting_id === mid && x.kind.startsWith("game")).map((x) => x.game)).size + 1);
        const rows = []; S.caravans.forEach((c) => { const o = g.v[c.id] || {}; if (o.perf) rows.push({ meeting_id: mid, caravan_id: c.id, kind: "game_perf", game: nm, points: o.perf }); if (o.coop) rows.push({ meeting_id: mid, caravan_id: c.id, kind: "game_coop", game: nm, points: o.coop }); });
        if (!rows.length) return toast("ما فيه نقاط تنحفظ.", "err");
        if ((S.field_events || []).some((x) => x.meeting_id === mid && x.game === nm)) return toast("فيه لعبة بنفس الاسم اليوم، غيّر الاسم.", "err");
        ui.game = { name: "", v: {} };
        return ctx.doUndoable(`انحفظت «${nm}»`, () => db.insert("field_events", rows), async (r) => { for (const x of r || []) await db.remove("field_events", { id: x.id }); }, ["field_events"]); }
      case "gmdel": { if (!arm("احذف؟")) return; const xs = (ctx.S().field_events || []).filter((x) => x.meeting_id === ctx.meetId() && x.game === b.dataset.g && x.kind.startsWith("game"));
        return ctx.doUndoable("انحذفت اللعبة", async () => { for (const x of xs) await db.remove("field_events", { id: x.id }); return xs; }, async (r) => { await db.insert("field_events", r.map(({ id, created_at, ...x }) => x)); }, ["field_events"]); }
    }
  });

  return {
    viewField, viewGather, viewGame,
    viewMatch: (id) => { mode = "staff"; return viewMatch(id, "#field"); },
    viewLink,
    leave: () => { mode = "staff"; document.body.classList.remove("is-match"); clearInterval(tick); clearInterval(ui.gT); curMid = null; keepAwake(false); },
    isField: () => mode === "field",
  };
}
