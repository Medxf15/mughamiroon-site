import { auth, db, ApiError, storage } from "./api.js";
import { ALL_LINES } from "./film.js";
import * as L from "./logic.js";
import { planFor, toMin, fmt12 } from "./plans.js";
import { powerCard, powerIcon, powerBack } from "./pcard.js";

// ---------------- state ----------------
const TABLES = ["caravans", "kids", "meetings", "points", "deductions", "team_challenge", "matches", "goals", "cards", "league_rounds", "badges", "measures", "kid_notes", "power_cards", "seals", "app_settings", "duty_log"];
let S = null, I = null, me = null, accounts = [];
let meetId = null;
let ui = { present: (() => { try { return localStorage.getItem("mgh.present") === "1"; } catch (e) { return false; } })(), seenCards: new Set(), liveCar: "all", kidsQ: "", kidsCar: "all", leagueTab: "matches", screenTab: "caravans", openDed: null, openMatch: null, armed: null };
const $app = () => document.getElementById("app");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return d + " " + ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"][m - 1]; };
const ROLE_AR = { owner: "مسؤول الفئة", program_manager: "مدير البرنامج", club_manager: "مدير النادي", assistant: "المساعد", other: "أخرى" };
const PERMS = [["points", "الحضور والنقاط والخصم"], ["league", "الدوري"], ["passport", "جواز المغامر"], ["kids", "الأسماء والقوافل"], ["plan", "بيانات اللقاءات"]];

function can(area) {
  if (!me || me.status !== "approved") return false;
  if (me.role === "owner") return true;
  if (me.role === "assistant") return !!(me.perms && me.perms[area]);
  return false;
}
const isOwner = () => me && me.status === "approved" && me.role === "owner";

function toast(msg, kind = "ok", undo) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = ""; const sp = document.createElement("span"); sp.textContent = msg; t.appendChild(sp);
  if (undo) { const bt = document.createElement("button"); bt.className = "toast-undo"; bt.textContent = "↩︎ تراجع"; bt.onclick = async () => { t.classList.remove("show"); await guard(undo, "تم التراجع"); render(); }; t.appendChild(bt); }
  t.className = "toast " + kind + (undo ? " has-undo" : "") + " show";
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), kind === "err" ? 5000 : undo ? 8000 : 2200);
}
/** run a change, then offer «تراجع» for 8 seconds */
async function doUndoable(msg, fn, undo, tables) {
  const r = await guard(fn); if (r === undefined) return;
  if (tables) await guard(() => reload(...tables));
  toast(msg, "ok", async () => { await undo(r); if (tables) await reload(...tables); });
  render();
}
const first = (r) => (Array.isArray(r) ? r[0] : r) || {};
async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e instanceof ApiError ? e.message : "حدث خطأ: " + (e.message || e), "err"); console.error(e); return undefined; }
}

// ---------------- data ----------------
async function loadAll() {
  const res = await Promise.all(TABLES.map((t) => db.select(t, t === "meetings" ? { order: "meet_date.asc" } : t === "matches" ? { order: "round.asc,id.asc" } : {})));
  S = {}; TABLES.forEach((t, i) => (S[t] = res[i] || []));
  S.caravans.sort((a, b) => a.sort - b.sort);
  I = L.index(S);
  if (!meetId || !I.meet[meetId]) { const c = L.currentMeeting(S); meetId = c ? c.id : null; }
}
async function reload(...tables) {
  const res = await Promise.all(tables.map((t) => db.select(t, t === "meetings" ? { order: "meet_date.asc" } : t === "matches" ? { order: "round.asc,id.asc" } : {})));
  tables.forEach((t, i) => (S[t] = res[i] || []));
  S.caravans.sort((a, b) => a.sort - b.sort);
  I = L.index(S);
}
async function renumber() {
  const ms = await db.select("meetings", { order: "meet_date.asc" });
  for (let i = 0; i < ms.length; i++) if (ms[i].number !== i + 1) await db.update("meetings", { id: ms[i].id }, { number: i + 1 });
  await reload("meetings", "points", "deductions", "team_challenge", "matches");
  if (!meetId || !I.meet[meetId]) { const c = L.currentMeeting(S); meetId = c ? c.id : null; }
}
async function loadMe() {
  const uid = auth.userId; if (!uid) { me = null; return; }
  const r = await db.select("profiles", { id: "eq." + uid });
  me = r && r[0] ? r[0] : null;
}
async function loadAccounts() { accounts = isOwner() ? await db.select("profiles", { order: "created_at.desc" }) : []; }

// ---------------- routing ----------------
function parseRoute() {
  const h = location.hash.replace(/^#/, "");
  const [name, arg] = h.split("/");
  return { name: name || "home", arg };
}
// [route, label, icon, visible, mobile tab]
const NAV = [
  ["home", "اليوم", "🗓️", () => true, true],
  ["live", "التحضير والنقاط", "✅", () => can("points"), true],
  ["caravans", "القوافل", "🐪", () => true, true],
  ["league", "الدوري", "⚽", () => true, true],
  ["kids", "المغامرون", "🎒", () => true, false],
  ["admin", "الإدارة", "⚙️", () => true, true],
];
const SECTION = { plan: "home", cards: "league", studio: "admin", kid: "kids", caravan: "caravans", reports: "admin", accounts: "admin", guide: "admin", seals: "admin", profile: "admin", road: "admin", kit: "home" };

let screenTimer = null;
async function render() {
  clearInterval(screenTimer); screenTimer = null;
  const r = parseRoute();
  document.body.classList.toggle("is-screen", r.name === "screen");
  document.body.classList.toggle("is-print", r.name === "print");
  document.body.classList.toggle("present", !!ui.present);
  if (["login", "signup", "forgot", "reset"].includes(r.name) || !auth.session) {
    if (r.name === "reset" && auth.session) return viewReset();
    if (!auth.session) return r.name === "signup" ? viewSignup() : r.name === "forgot" ? viewForgot() : viewLogin();
  }
  if (!me) { await guard(loadMe); }
  if (!me) return viewLogin("ما قدرنا نجيب بيانات حسابك. سجّل الدخول من جديد.");
  if (me.status !== "approved") return viewPending();
  if (!S) { $app().innerHTML = shell('<div class="empty">جاري تحميل البيانات…</div>'); await guard(loadAll); if (!S) return; if (isOwner()) await guard(loadAccounts); }
  else if (r.name === "accounts" && isOwner()) await guard(loadAccounts);
  const views = { home: viewToday, kit: viewToday, live: viewLive, caravans: viewCaravans, caravan: viewCaravan, league: viewLeague, kids: viewKids, kid: viewKid, reports: viewReports, accounts: viewAccounts, screen: viewScreen, profile: viewProfile, road: viewGuide, guide: viewGuide, seals: viewSeals, admin: viewAdmin, print: viewPrint, studio: viewStudio, plan: viewPlan, cards: viewCards };
  const fn = views[r.name] || viewToday;
  if (r.name === "live" && !can("points")) return go("home");
  if (r.name === "accounts" && !isOwner()) return go("home");
  fn(r.arg);
}
function go(name) { if (location.hash !== "#" + name) location.hash = name; else render(); }

// ---------------- layout ----------------
function shell(inner, active) {
  const pend = isOwner() ? accounts.filter((a) => a.status === "pending").length : 0;
  const sec = SECTION[active] || active;
  const items = NAV.filter((n) => n[3]());
  const badge = (n) => (n[0] === "admin" && pend ? ` <b class="dot-n">${pend}</b>` : "");
  const nav = items.map((n) => `<a href="#${n[0]}" class="${n[0] === sec ? "on" : ""}">${n[1]}${badge(n)}</a>`).join("");
  const tabs = items.filter((n) => n[4]).map((n) => `<a href="#${n[0]}" class="${n[0] === sec ? "on" : ""}"><span class="ti">${n[2]}</span><span>${n[0] === "live" ? "التحضير" : n[1]}</span>${badge(n)}</a>`).join("");
  return `
  <header class="top">
    <div class="wrap top-in">
      <a class="brand" href="#home" aria-label="اليوم"><img src="assets/mahara.png" alt="نادي مهارة"><span><b>المغامرون</b><small>حي الهجرة</small></span></a>
      <nav class="nav" aria-label="الأقسام">${nav}</nav>
      <div class="tools">
        <a href="#screen" class="tool" title="شاشة التلفاز">📺<span>الشاشة</span></a>
        <button class="tool pm-btn ${ui.present ? "on" : ""}" data-act="present_mode" aria-pressed="${!!ui.present}" title="يخفي ملاحظاتك الخاصة لما تعرض المنصة للمشاركين">${ui.present ? "👁️" : "🔒"}<span>${ui.present ? "وضع العرض" : "ملاحظاتي"}</span></button>
        <a class="who" href="#profile" title="حسابي"><span>${esc((me.full_name || me.email).split(" ")[0])}</span><small>${ROLE_AR[me.role] || ""}</small></a>
      </div>
    </div>
    <div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </header>
  <main class="wrap main">${inner}</main>
  <nav class="tabbar" aria-label="التنقل">${tabs}</nav>`;
}
/** page header: title, subtitle, actions */
const pageHead = (title, sub, actions = "") => `<section class="phead"><div><h1 class="h1">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div><div class="phead-act">${actions}</div></section>`;
function meetPicker() {
  return `<label class="mp"><span>اللقاء</span><select data-act="meet">${S.meetings.map((m) => `<option value="${m.id}" ${m.id === meetId ? "selected" : ""}>اللقاء ${m.number || ""} · ${fmtDate(m.meet_date)}</option>`).join("")}</select></label>`;
}
const carStyle = (c) => `--tc:${esc(c ? c.color : "#6b7cff")}`;
const carName = (id) => (I.car[id] ? I.car[id].name : "بدون قافلة");

// ---------------- auth views ----------------
function authShell(inner) {
  $app().innerHTML = `<div class="auth"><div class="auth-card"><img src="assets/mahara.png" alt="نادي مهارة" class="auth-logo"><h1>منصة المغامرين</h1><p class="muted">نادي مهارة · حي الهجرة</p>${inner}</div></div>`;
}
function viewLogin(msg) {
  authShell(`${msg ? `<p class="alert">${esc(msg)}</p>` : ""}
  <form id="f-login" class="form" novalidate>
    <label>الإيميل<input id="li-email" type="email" autocomplete="email" required></label>
    <label>كلمة المرور<input id="li-pass" type="password" autocomplete="current-password" required></label>
    <button class="btn" type="submit">دخول</button>
  </form>
  <div class="auth-links"><a href="#signup">ما عندك حساب؟ أنشئ حسابًا</a><a href="#forgot">نسيت كلمة المرور</a></div>`);
  document.getElementById("f-login").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("li-email").value.trim(), pass = document.getElementById("li-pass").value;
    if (!email || !pass) return toast("اكتب الإيميل وكلمة المرور.", "err");
    const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "جاري الدخول…";
    const ok = await guard(() => auth.signIn(email, pass));
    b.disabled = false; b.textContent = "دخول";
    if (ok) { me = null; S = null; await guard(loadMe); location.hash = "home"; render(); }
  };
}
function viewSignup() {
  authShell(`<form id="f-up" class="form" novalidate>
    <label>الاسم<input id="su-name" autocomplete="name" required maxlength="60"></label>
    <label>الإيميل<input id="su-email" type="email" autocomplete="email" required></label>
    <label>كلمة المرور<input id="su-pass" type="password" autocomplete="new-password" minlength="8" required><small class="muted">8 أحرف على الأقل</small></label>
    <label>صفتك في النادي<select id="su-role"><option value="assistant">مساعد</option><option value="program_manager">مدير البرنامج</option><option value="club_manager">مدير النادي</option><option value="other">أخرى</option></select></label>
    <button class="btn" type="submit">إنشاء الحساب</button>
    <p class="muted small">بعد إنشاء الحساب يوافق عليه مسؤول الفئة قبل ما تقدر تدخل.</p>
  </form><div class="auth-links"><a href="#login">عندي حساب، سجّل دخولي</a></div>`);
  document.getElementById("f-up").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("su-name").value.trim(), email = document.getElementById("su-email").value.trim(), pass = document.getElementById("su-pass").value, role = document.getElementById("su-role").value;
    if (!name || !email) return toast("اكتب الاسم والإيميل.", "err");
    if (pass.length < 8) return toast("كلمة المرور لازم تكون 8 أحرف على الأقل.", "err");
    const b = e.target.querySelector("button"); b.disabled = true;
    const r = await guard(() => auth.signUp(email, pass, name, role));
    b.disabled = false;
    if (r === undefined) return;
    if (r && r.access_token) { await guard(() => auth.signIn(email, pass)); me = null; location.hash = "home"; return render(); }
    authShell(`<p class="alert ok">تم إرسال طلبك بإيميل <b>${esc(email)}</b>. ما تحتاج تفتح رسالة التفعيل: أول ما يوافق مسؤول الفئة على حسابك، ادخل بنفس الإيميل وكلمة المرور.</p><div class="auth-links"><a href="#login">الذهاب لتسجيل الدخول</a></div>`);
  };
}
function viewForgot() {
  authShell(`<form id="f-fg" class="form"><label>الإيميل<input id="fg-email" type="email" autocomplete="email" required></label><button class="btn" type="submit">أرسل رابط تغيير كلمة المرور</button></form><div class="auth-links"><a href="#login">رجوع لتسجيل الدخول</a></div>`);
  document.getElementById("f-fg").onsubmit = async (e) => {
    e.preventDefault(); const email = document.getElementById("fg-email").value.trim(); if (!email) return;
    const r = await guard(() => auth.recover(email)); if (r !== undefined) authShell(`<p class="alert ok">إذا كان الإيميل مسجّلًا، بيوصلك رابط لتغيير كلمة المرور.</p><div class="auth-links"><a href="#login">رجوع لتسجيل الدخول</a></div>`);
  };
}
function viewReset() {
  authShell(`<form id="f-rs" class="form"><label>كلمة المرور الجديدة<input id="rs-pass" type="password" autocomplete="new-password" minlength="8" required></label><button class="btn" type="submit">حفظ كلمة المرور</button></form>`);
  document.getElementById("f-rs").onsubmit = async (e) => {
    e.preventDefault(); const p = document.getElementById("rs-pass").value; if (p.length < 8) return toast("8 أحرف على الأقل.", "err");
    const r = await guard(() => auth.setPassword(p), "تم حفظ كلمة المرور الجديدة"); if (r !== undefined) { location.hash = "home"; render(); }
  };
}
function viewPending() {
  const rej = me.status === "rejected";
  authShell(`<p class="alert ${rej ? "" : "ok"}">${rej ? "لم تتم الموافقة على حسابك. إذا تعتقد إن هذا خطأ تواصل مع مسؤول فئة المغامرين." : `أهلًا ${esc(me.full_name)}، حسابك بانتظار موافقة مسؤول الفئة. ارجع لهذي الصفحة بعد الموافقة.`}</p>
  <div class="row-btns"><button class="btn ghost" data-act="recheck">تحقّق مرة ثانية</button><button class="btn ghost" data-act="logout">تسجيل الخروج</button></div>`);
}

// ---------------- home ----------------
function stepDone(mid, key) { try { return localStorage.getItem(`mgh.step.${mid}.${key}`) === "1"; } catch (e) { return false; } }
function viewToday() {
  const m = I.meet[meetId]; if (!m) return ($app().innerHTML = shell(pageHead("اليوم", "ما فيه لقاءات بعد. أضف لقاء من الإدارة ← التقارير.") , "home"));
  const act = L.activeKids(S); const ed = can("points");
  const recN = act.filter((k) => L.recorded(I, m.id, k.id)).length; const presN = act.filter((k) => L.recorded(I, m.id, k.id) && L.present(I, m.id, k.id)).length;
  const nx = nextMeeting(m);
  const dutyCar = (key, mm = m) => S.caravans.find((c) => (L.dutyOf(S, mm, c.id) || {}).key === key);
  const lead = (c) => (c && c.leader_kid && I.kid[c.leader_kid] ? I.kid[c.leader_kid].first_name : null);
  const dutyRow = (key) => { const c = dutyCar(key); if (!c) return ""; const d = L.dutyOf(S, m, c.id); const ok = L.dutyMastered(S, m.id, c.id);
    return `<div class="dt-row ${ok ? "ok" : ""}" style="${carStyle(c)}"><span class="dt-ic">${d.icon}</span><div><b>${esc(d.name)}</b><small>قافلة ${esc(c.name)}${lead(c) ? " · القائد " + esc(lead(c)) : ""}</small></div>${ed ? `<button class="chip dchip" data-act="duty" data-car="${c.id}" data-mid="${m.id}" aria-pressed="${ok}">${ok ? "✅ أتقنوا" : "أتقنوا؟"}</button>` : ok ? "✅" : ""}</div>`; };
  const kalC = dutyCar("kalima"); const kd = kalC && L.dutyRow(S, m.id, kalC.id);
  const kalNext = nx && dutyCar("kalima", nx);
  const todayMatches = S.matches.filter((x) => x.meeting_id === m.id);
  const pend = S.caravans.map((c) => [c, L.pendingDraws(S, I, m.id, c.id)]).filter(([, p]) => p.length);
  const drawn = (S.power_cards || []).filter((p) => p.meeting_id === m.id);
  const lv = newLevels(m); const sealsToday = L.sealState(S, I).at[m.id] || [];
  const steps = [
    { key: "prep", time: "4:30", icon: "🧳", title: "قبل اللقاء", auto: null,
      body: `<ul class="todo"><li>بطاقات التكليف الأربع، وصندوق بطاقات القوة</li><li>${lv.length || (nx && kalNext && L.dutyRow(S, nx.id, kalNext.id)?.topic != null) ? `<a href="#print/meet">🖨️ اطبع بطاقات هذا اللقاء</a>` : "ما فيه بطاقات أسماء تحتاج طباعة الآن"}</li><li><a href="#screen">📺 افتح الشاشة</a> على التلفاز</li></ul>` },
    { key: "start", time: "5:00", icon: "🚩", title: "الانطلاقة", auto: null,
      body: `<p>سلّم كل <b>قائد</b> بطاقة تكليف قافلته، وذكّرهم: <i>${esc(L.LEAD.motto)}</i>.</p><div class="lead-grid">${S.caravans.map((c) => { const d = L.dutyOf(S, m, c.id); return `<a class="lead-mini" href="#caravan/${c.id}" style="${carStyle(c)}"><b>${esc(c.name)}</b><span>🎖️ ${lead(c) ? esc(lead(c)) : '<span class="muted">بدون قائد</span>'}</span><small>${d ? d.icon + " " + esc(d.short) : ""}</small></a>`; }).join("")}</div>` },
    { key: "att", time: "5:15", icon: "✅", title: "التحضير والنقاط", auto: recN > 0,
      body: `<p>${recN ? `سُجّل حضور <b class="num">${presN}</b> من <b class="num">${act.length}</b>.` : "ما بدأ التحضير بعد."} البطاقات الخمس تُكسب طوال اللقاء.</p>${ed ? `<a class="btn sm" href="#live">افتح التحضير والنقاط</a>` : ""}` },
    { key: "prayer", time: "الصلاة", icon: "🕌", title: "الصلاة والكلمة", auto: null,
      body: `${dutyRow("musalla")}${dutyRow("kalima")}${kalC ? `<p class="small">${kd && kd.speaker_kid ? `🎙️ المتحدث: <b>${esc(L.kidName(I.kid[kd.speaker_kid]))}</b>${kd.topic != null ? " · " + esc(L.TOPICS[kd.topic].t) : ""}` : ed ? `<span class="alert">اختر متحدث وموضوع ${esc(kalC.name)}:</span>` : ""}</p>${ed && !(kd && kd.speaker_kid && kd.topic != null) ? `<div class="duty-kal">${kalimaPick(kalC, m)}</div>` : ""}` : ""}` },
    { key: "meal", time: "الوجبة", icon: "🍽️", title: "الوجبة والنظافة", auto: null, body: `${dutyRow("food")}${dutyRow("clean")}` },
    { key: "league", time: "الميدان", icon: "⚽", title: "الدوري", auto: todayMatches.length ? todayMatches.every((x) => x.played) : null,
      body: `${todayMatches.length ? `<div class="mini-matches">${todayMatches.map((x) => `<a href="#league" class="mm ${x.played ? "done" : ""}"><span style="${carStyle(I.car[x.home_id])}">${esc(carName(x.home_id))}</span><b class="num">${x.played ? x.home_goals + " – " + x.away_goals : "ضد"}</b><span style="${carStyle(I.car[x.away_id])}">${esc(carName(x.away_id))}</span></a>`).join("")}</div>` : '<p class="muted">ما فيه مباريات في هذا اللقاء.</p>'}
        <p>🎴 <a href="#cards">بطاقات القوة: اسحب أو سجّل المستخدمة</a></p>
        ${drawn.length ? `<p class="small">سلّم البطاقات المطبوعة: ${drawn.map((p) => `${esc(L.POWER[p.kind].name)} ← ${esc(carName(p.caravan_id))}`).join("، ")}</p>` : ""}
        <p class="small muted">قبل الصافرة: كل قافلة تعلن بطاقتها، والكابتن يمثلها.</p>` },
    { key: "close", time: "9:45", icon: "🌙", title: "الختام", auto: null,
      body: `<div class="close-stars">${S.caravans.map((c) => { const t = L.teamMeet(S, I, m.id, c.id); return `<span style="${carStyle(c)}">${esc(c.name)} ${t.stars === 2 ? "🌟" : t.stars ? "⭐" : `<small class="num">${t.ready}/${t.n}</small>`}</span>`; }).join("")}</div>
        <p>📜 الرسائل: ${sealsToday.length ? sealsToday.map((x) => `<b>${esc(carName(x.cid))}</b> فتحت «${esc(x.seal.title)}»`).join("، ") + ` · <a href="#screen">اعرضها على الشاشة</a>` : "ما وصلت أي قافلة محطة جديدة بعد. كل نجمة = خطوة."}</p>
        ${lv.length ? `<p>🏅 مستويات جديدة: ${lv.map((x) => `${x.lv.icon} <b>${esc(x.k.first_name)}</b> «${esc(x.lv.name)}»`).join("، ")} · <a href="#print/meet">اطبع بطاقاتهم</a></p>` : ""}
        <p class="reflect">سؤال التأمل: <b>«متى حسّيت إن فريقك يحتاجك؟»</b></p>
        ${kalNext ? `<div class="next-kal"><p>🎙️ كلمة اللقاء القادم على <b>${esc(kalNext.name)}</b>: يختارون المتحدث، وأنت تعطيه بطاقة الموضوع.</p>${ed ? `<div class="duty-kal">${kalimaPick(kalNext, nx)}</div>` : ""}</div>` : ""}
        <p class="small"><a href="#reports">📝 التقرير الأسبوعي جاهز للنسخ</a></p>` },
  ];
  steps.forEach((st) => (st.done = st.auto === true || stepDone(m.id, st.key)));
  const nowIdx = steps.findIndex((st) => !st.done);
  const doneN = steps.filter((st) => st.done).length;
  const totStars = S.caravans.reduce((n, c) => n + L.teamMeet(S, I, m.id, c.id).stars, 0);
  $app().innerHTML = shell(`
    <section class="today-hero">
      <div><p class="muted">${m.number ? `اللقاء ${m.number}` : ""}${m.theme ? " · " + esc(m.theme) : ""}</p><h1>الخميس ${fmtDate(m.meet_date)}</h1>
        <div class="hero-chips"><span>👥 <b class="num">${recN ? presN + "/" + act.length : "—"}</b> حضور</span><span>⭐ <b class="num">${totStars}</b> نجوم اليوم</span><span>📜 <b class="num">${sealsToday.length}</b> رسائل انفتحت</span></div></div>
      <div class="hero-side">${meetPicker()}<div class="hero-prog"><div class="prog"><i style="width:${Math.round((doneN / steps.length) * 100)}%"></i></div><small class="num">${doneN} من ${steps.length} محطات</small></div></div>
    </section>
    ${planFor(m.number) ? `<a class="plan-banner" href="#plan/${m.number}"><span>📋</span><div><b>دليل اللقاء: ${esc(planFor(m.number).title)}</b><small>كل فقرة بالدقيقة، واللي تقوله، ومهام المساعد والقادة</small></div><i>←</i></a>` : ""}
    ${isOwner() && accounts.some((a) => a.status === "pending") ? `<a class="notice" href="#accounts">${accounts.filter((a) => a.status === "pending").length} حساب ينتظر موافقتك</a>` : ""}
    <ol class="day">${steps.map((st, i) => `<li class="day-step ${st.done ? "done" : ""} ${i === nowIdx ? "now" : ""}">
      <div class="ds-rail"><span class="ds-dot">${st.done ? "✓" : st.icon}</span></div>
      <div class="ds-card"><header><span class="ds-time">${st.time}</span><h3>${st.title}</h3>${i === nowIdx ? '<span class="ds-now">الحين</span>' : ""}
        ${st.auto === null || st.auto === undefined ? `<button class="ds-check" data-act="stepdone" data-mid="${m.id}" data-k="${st.key}" aria-pressed="${st.done}">${st.done ? "✓ تم" : "تم؟"}</button>` : st.done ? '<span class="ds-auto">✓ تلقائي</span>' : ""}</header>
        <div class="ds-body">${st.body}</div></div></li>`).join("")}</ol>`, "home");
}

// ---------------- live meeting ----------------
function viewLive() {
  const m = I.meet[meetId]; if (!m) return ($app().innerHTML = shell('<div class="empty">أضف لقاءً أولًا.</div>', "live"));
  const tabs = `<div class="seg" role="group" aria-label="القافلة"><button data-act="livecar" data-v="all" aria-pressed="${ui.liveCar === "all"}">الكل</button>${S.caravans.map((c) => `<button data-act="livecar" data-v="${c.id}" aria-pressed="${String(ui.liveCar) === String(c.id)}" style="${carStyle(c)}">${esc(c.name)}</button>`).join("")}</div>`;
  const cars = S.caravans.filter((c) => ui.liveCar === "all" || String(c.id) === String(ui.liveCar));
  const noCar = L.activeKids(S).filter((k) => !k.caravan_id);
  const blocks = cars.map((c) => liveCaravan(c, m)).join("");
  $app().innerHTML = shell(`
    <section class="bar">${meetPicker()}<div class="legend">${L.CATS.map((c) => `<span><i class="dot" style="--c:${c[2]}"></i>${c[1]}</span>`).join("")}</div></section>
    ${tabs}
    ${noCar.length ? `<p class="alert">${noCar.length} مغامر بدون قافلة. وزّعهم من <a href="#caravans">القوافل</a>.</p>` : ""}
    <div class="live">${blocks}</div>
    ${ui.reveal ? revealHTML(ui.reveal, true) : ""}
    <p class="muted small">الكل حاضر افتراضيًا: اضغط «حاضر» للغائب فقط. النجمة: كل الحاضرين ${L.NC - 1} نقاط فأكثر. الذهبية: الكل ${L.NC}. الخصم بعد إنذار، وأقصاه ${L.DED_CAP} نقاط في اللقاء، وسببه لا يظهر على الشاشة.</p>`, "live");
}
function liveCaravan(c, m) {
  const r = L.teamMeet(S, I, m.id, c.id);
  const ks = L.kidsOf(S, c.id);
  const st = r.stars === 2 ? "🌟 ذهبية" : r.stars === 1 ? "⭐ نجمة" : `جاهزون <b class="num">${r.ready}/${r.n}</b>`;
  const rows = ks.map((k) => {
    const p = L.row(I, m.id, k.id) || {}; const pr = L.present(I, m.id, k.id); const n = L.net(I, m.id, k.id);
    const ds = L.deds(I, m.id, k.id); const wd = L.warned(I, m.id, k.id);
    const canFz = pr && (p.fazaa || (n === L.NC - 2 && !r.fz));
    const role = L.roleOf(S, k, m.number);
    return `<div class="krow ${pr ? "" : "abs"}">
      <div class="kwho"><a href="#kid/${k.id}" class="nm">${esc(L.kidName(k))}</a><small>${L.leaderOf(S, k.id).map((x) => `<span class="ltag ${x[0]}">${x[1]} ${x[2]}</span> `).join("")}${k.official ? "" : '<span class="tag">غير مسجّل</span> '}${role ? esc(role[1]) + " · " : ""}<span class="num">${n}/${L.NC}</span> · المجموع <span class="num">${L.kidTotal(S, I, k.id)}</span></small></div>
      <div class="chips">
        <button class="chip pres" data-act="present" data-k="${k.id}" aria-pressed="${!pr}">${pr ? "حاضر" : "غائب"}</button>
        ${pr ? L.CATS.map((cat) => `<button class="chip" style="--c:${cat[2]}" data-act="pt" data-k="${k.id}" data-c="${cat[0]}" aria-pressed="${!!p[cat[0]]}">${cat[1]}</button>`).join("") : ""}
        ${canFz ? `<button class="chip fz" data-act="fazaa" data-k="${k.id}" aria-pressed="${!!p.fazaa}">🤝 فزعة</button>` : ""}
        ${pr ? (wd ? `<button class="chip ded" data-act="dedopen" data-k="${k.id}" aria-expanded="${ui.openDed === k.id}">− خصم</button>` : `<button class="chip warn" data-act="warn" data-k="${k.id}">⚠ إنذار</button>`) : ""}
      </div>
      ${ds.length ? `<div class="dlist">${ds.map((d) => `<span class="${d.value === 0 ? "w" : ""}">${d.value === 0 ? "إنذار" : "−" + d.value} · ${esc(d.reason)} <button data-act="dedundo" data-id="${d.id}" aria-label="تراجع عن ${d.value === 0 ? "الإنذار" : "الخصم"}">×</button></span>`).join("")}</div>` : ""}
      ${ui.openDed === k.id && pr ? `<div class="dedbox"><select id="dr-${k.id}" aria-label="سبب الخصم">${L.REASONS.map((x, i) => `<option value="${i}">${esc(x[0])} (−${x[1]})</option>`).join("")}</select><button class="btn danger sm" data-act="dedadd" data-k="${k.id}">تسجيل الخصم</button><button class="btn ghost sm" data-act="dedopen" data-k="${k.id}">إلغاء</button></div>` : ""}
    </div>`;
  }).join("");
  return `<section class="lcar" style="${carStyle(c)}">
    <header><h3>${esc(c.name)}</h3>${(() => { const d = L.dutyOf(S, m, c.id); return d ? `<span class="duty-tag">${d.icon} ${esc(d.short)}</span>` : ""; })()}<span class="st">${st}</span></header>
    ${rows || '<p class="muted pad">لا يوجد مغامرون في هذي القافلة.</p>'}
    ${dutyBar(c, m)}
    ${powerBar(c, m)}
    <footer><span>نقاط التحديات</span><button class="step" data-act="tc" data-car="${c.id}" data-d="-5" aria-label="نقص 5">−</button><output class="num">${r.ch}</output><button class="step" data-act="tc" data-car="${c.id}" data-d="5" aria-label="زد 5">+</button><small class="muted">أساسي 10 · متقدم 15 · خبير 20</small></footer>
  </section>`;
}

// ---------------- screen (TV) ----------------
function viewScreen() {
  const m = I.meet[meetId];
  const tabs = [["announce", "الإعلان"], ["caravans", "القوافل"], ["levels", "المستويات"], ["power", "بطاقات القوة"], ["seal", "الختم"], ["league", "الدوري"]];
  let body = "";
  if (ui.screenTab === "announce") {
    body = announceHTML();
  } else if (ui.screenTab === "caravans") {
    body = `<div class="tv-cars">${S.caravans.map((c) => {
      const t = L.teamTotals(S, I, c.id); const r = m ? L.teamMeet(S, I, m.id, c.id) : { stars: 0, ready: 0, n: 0 };
      const rd = L.roadOf(S, I, c.id); const pos = rd.pos; const fresh = rd.last && m && rd.last.meeting_id === m.id ? L.PERKS[rd.last.pos] : null;
      const road = L.ROAD.map((_, i) => `${i ? `<i class="${i <= pos ? "on" : ""}"></i>` : ""}<b class="${i < pos ? "on" : ""} ${i === pos ? "here" : ""}">${i === pos ? "🐪" : ""}</b>`).join("");
      const rk = L.kidsOf(S, c.id).map((k) => ({ k, tot: L.kidTotal(S, I, k.id) }));
      const pct = r.n ? Math.round((r.ready / r.n) * 100) : 0;
      return `<section class="tv-col ${r.stars ? "star" : ""}" style="${carStyle(c)}">
        <header><h2>${esc(c.name)}</h2>${(() => { const d = L.dutyOf(S, m, c.id); return d ? `<small class="tv-duty ${L.dutyMastered(S, m.id, c.id) ? "ok" : ""}">${d.icon} ${esc(d.short)}${L.dutyMastered(S, m.id, c.id) ? " ✓" : ""}</small>` : ""; })()}<span class="num">⭐ ${t.stars}</span></header>
        <div class="road" aria-label="موقع القافلة: ${esc(L.ROAD[pos])}">${road}</div>
        <ol class="tv-kids">${rk.map((x) => { const p = m ? L.row(I, m.id, x.k.id) || {} : {}; const pr = m ? L.present(I, m.id, x.k.id) : true; return `<li class="${pr ? "" : "abs"}"><span class="rk" title="${esc(L.level(x.tot).name)}">${L.level(x.tot).icon}</span><span class="nm">${esc(x.k.first_name)}${L.leaderOf(S, x.k.id).filter((y) => y[0] !== "captain").map((y) => " " + y[1]).join("")}</span><span class="pips">${L.CATS.map((cc) => `<i class="${p[cc[0]] ? "on" : ""}" style="--c:${cc[2]}"></i>`).join("")}</span><b class="num">${x.tot}</b></li>`; }).join("")}</ol>
        <footer><b>${r.stars === 2 ? "🌟 نجمة ذهبية هذا اللقاء" : r.stars === 1 ? "⭐ نجمة هذا اللقاء" : `جاهزون للنجمة <span class="num">${r.ready} من ${r.n}</span>`}</b><div class="prog"><i style="width:${pct}%"></i></div><span>📍 ${esc(L.ROAD[pos])} · 🎴 <b class="num">${L.freeCards(S, c.id).length}</b> · رصيد <b class="num">${t.bal}</b></span>${fresh ? `<span class="perk-new">🎁 ${esc(fresh.name)}: ${esc(fresh.what)}</span>` : ""}</footer>
      </section>`; }).join("")}</div>`;
  } else if (ui.screenTab === "levels") {
    body = levelsHTML(true);
  } else if (ui.screenTab === "power") {
    body = `<div class="tv-power">${S.caravans.map((c) => { const f = L.freeCards(S, c.id); const used = L.cardsOf(S, c.id).length - f.length;
      return `<section class="tv-pw" style="${carStyle(c)}"><header><h2>${esc(c.name)}</h2><span>🎴 <b class="num">${f.length}</b></span></header><div class="pc-row">${f.map((p) => pcardHTML(p.kind)).join("") || '<p class="muted">لا بطاقات بعد.</p>'}</div>${used ? `<small>استُخدمت <b class="num">${used}</b></small>` : ""}</section>`; }).join("")}</div>
      <p class="tv-legend">${[1, 2, 3, 4].map((t) => `<span class="tl t${t}">${L.TIER[t]}</span>`).join("")}<span>بطاقة وحدة لكل قافلة في المباراة، يعلنها الكابتن قبل البداية</span></p>`;
  } else if (ui.screenTab === "seal") {
    body = sealHTML(m, true);
  } else {
    const st = L.standings(S); const sc = L.scorers(S).slice(0, 5);
    body = `<div class="tv-league"><table class="tbl big"><thead><tr><th>القافلة</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>لعب نظيف</th><th>النقاط</th></tr></thead><tbody>${st.map((s, i) => `<tr><td><span class="sw" style="${carStyle(I.car[s.id])}"></span>${i === 0 && s.p ? "🏆 " : ""}${esc(carName(s.id))}</td><td class="num">${s.p}</td><td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf}</td><td class="num">${s.ga}</td><td class="num">${s.fair}</td><td class="num"><b>${s.pts}</b></td></tr>`).join("")}</tbody></table>
      <div class="tv-side"><h3>⚽ الهدافون</h3>${sc.length ? `<ol>${sc.map((x) => `<li>${esc(L.kidName(I.kid[x.kid]))} <b class="num">${x.n}</b></li>`).join("")}</ol>` : '<p class="muted">لا أهداف بعد</p>'}
      <h3>🟦 بطاقات الأمانة</h3><p class="num big-n">${S.cards.filter((c) => c.color === "blue").length}</p></div></div>`;
  }
  const nw = (S.power_cards || []).filter((p) => !ui.seenCards.has(p.id) && Date.now() - new Date(p.created_at).getTime() < 120000).sort((a, b) => b.id - a.id)[0];
  (S.power_cards || []).forEach((p) => ui.seenCards.add(p.id));
  if (nw && ui.tvBooted) { ui.tvReveal = { car: nw.caravan_id, kind: nw.kind }; clearTimeout(ui.tvRevealT); ui.tvRevealT = setTimeout(() => { ui.tvReveal = null; if (parseRoute().name === "screen") viewScreen(); }, 12000); }
  ui.tvBooted = true;
  $app().innerHTML = `<div class="tv">
    <header class="tv-top"><img src="assets/mahara.png" alt="نادي مهارة"><h1>${m ? `اللقاء ${m.number} · ${fmtDate(m.meet_date)}` : "المغامرون"}</h1>
      <div class="seg dark" role="group" aria-label="العرض">${tabs.map((t) => `<button data-act="scrtab" data-v="${t[0]}" aria-pressed="${ui.screenTab === t[0]}">${t[1]}</button>`).join("")}</div>
      <a class="tv-exit" href="#home">خروج</a></header>
    ${body}
    ${ui.tvReveal ? revealHTML(ui.tvReveal, false) : ""}
    <p class="tv-legend">${L.CATS.map((c) => `<span><i class="dot" style="--c:${c[2]}"></i>${c[1]}</span>`).join("")}<span>⭐ كل القافلة ${L.NC - 1} نقاط فأكثر</span><span>🌟 كل القافلة ${L.NC}</span></p>
  </div>`;
  if (ui.screenTab === "announce") return;
  screenTimer = setInterval(async () => { if (parseRoute().name !== "screen") return; if (ui.screenTab === "announce") return; try { await reload("points", "deductions", "team_challenge", "matches", "goals", "cards", "kids", "caravans", "league_rounds", "power_cards", "seals", "app_settings", "duty_log"); viewScreen(); } catch (e) {} }, 10000);
}

// ---------------- caravans ----------------
function viewCaravans() {
  const m = I.meet[meetId]; const edit = can("kids"); const plan = ui.balancePlan;
  const cards = S.caravans.map((c) => {
    const ks = L.kidsOf(S, c.id); const t = L.teamTotals(S, I, c.id); const rd = L.roadOf(S, I, c.id); const d = L.dutyOf(S, m, c.id);
    const nm = (id) => (id && I.kid[id] ? esc(I.kid[id].first_name) : '<span class="muted">—</span>');
    return `<a class="car-card" href="#caravan/${c.id}" style="${carStyle(c)}">
      <header><h2>${esc(c.name)}</h2><span class="cc-stars">⭐ <b class="num">${t.stars}</b></span></header>
      <div class="cc-lead"><span>🎖️ القائد<b>${nm(c.leader_kid)}</b></span><span>🔰 النائب<b>${nm(c.deputy_kid)}</b></span><span>⚽ الكابتن<b>${nm(c.captain_kid)}</b></span></div>
      <div class="cc-meta"><span>👥 <b class="num">${ks.length}</b></span><span>📍 ${esc(L.ROAD[rd.pos])}</span><span>🎴 <b class="num">${L.freeCards(S, c.id).length}</b></span>${d ? `<span>${d.icon} ${esc(d.short)}</span>` : ""}</div>
      <span class="cc-open">افتح القافلة ←</span></a>`;
  }).join("");
  $app().innerHTML = shell(`
    ${pageHead("القوافل", "اضغط على أي قافلة تشوف قيادتها وأعضاءها وطريقها وبطاقاتها.", meetPicker())}
    <div class="car-cards">${cards}</div>
    ${edit ? drawPanel() : ""}
    ${edit ? `<details class="panel tools-box" ${plan ? "open" : ""}><summary><h3>⚖️ أدوات التوزيع المتوازن</h3></summary><p class="muted small">قاعدة العدالة: <b>الحارس الثابت ميزة، والعدد الأكبر ميزة، وما تجتمع الميزتان في قافلة وحدة.</b> كل قافلة تاخذ حارس ثابت واحد إذا توفر، والقافلة اللي بدون حارس ثابت (يتناوبون على المرمى) تاخذ اللاعب الزايد إذا العدد ما انقسم بالتساوي. بعدها يتوزع الدفاع والوسط والهجوم بأقل فرق ممكن بين القوافل، ويُفصل من يحملون نفس اسم العائلة، ويبقى الطفل في قافلته الحالية إذا تساوت الخيارات. تراجعه قبل الاعتماد، وتقدر تغيّر أي طفل بعدها.</p>${(() => { const gk = L.activeKids(S).filter((k) => k.position === "gk").length; return gk < S.caravans.length ? `<p class="alert">عندك ${gk} حراس لـ${S.caravans.length} قوافل، فـ${S.caravans.length - gk} قافلة بتلعب بحارس متناوب، ولها الأفضلية في العدد إذا ما انقسم بالتساوي.</p>` : ""; })()}
      ${plan ? `<table class="tbl"><thead><tr><th>المغامر</th><th>المركز</th><th>الحرف</th><th>الحالية</th><th>المقترحة</th></tr></thead><tbody>${L.activeKids(S).slice().sort((a, b) => String(plan[a.id]).localeCompare(String(plan[b.id]))).map((k) => `<tr class="${plan[k.id] !== k.caravan_id ? "chg" : ""}"><td>${esc(L.kidName(k))}</td><td>${esc(L.POSITIONS[k.position] || "—")}</td><td>${esc(k.trait || "—")}</td><td>${esc(carName(k.caravan_id))}</td><td><b>${esc(carName(plan[k.id]))}</b></td></tr>`).join("")}</tbody></table>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>القافلة</th><th>العدد</th><th>الحارس الثابت</th><th>دفاع</th><th>وسط</th><th>هجوم</th><th>بدون مركز</th></tr></thead><tbody>${L.balanceSummary(S, plan).map((x) => `<tr><td><span class="sw" style="${carStyle(x.c)}"></span>${esc(x.c.name)}</td><td class="num"><b>${x.size}</b></td><td>${x.gk ? esc(L.kidName(x.gk)) : "<b>حارس متناوب</b>"}</td><td class="num">${x.def}</td><td class="num">${x.mid}</td><td class="num">${x.fwd}</td><td class="num">${x.none}</td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn" data-act="balapply">اعتمد التوزيع</button><button class="btn ghost" data-act="balcancel">إلغاء</button></div>`
        : `<button class="btn ghost" data-act="balance">اقترح توزيعًا متوازنًا</button>`}</details>` : ""}
`, "caravans");
}
function viewCaravan(id) {
  const c = I.car[Number(id)]; if (!c) return go("caravans");
  const m = I.meet[meetId]; const edit = can("kids"); const ks = L.kidsOf(S, c.id); const t = L.teamTotals(S, I, c.id);
  const rd = L.roadOf(S, I, c.id); const nx = L.PERKS[rd.pos + 1]; const d = L.dutyOf(S, m, c.id); const r = m ? L.teamMeet(S, I, m.id, c.id) : null;
  const road = L.ROAD.map((name, i) => `${i ? `<i class="${i <= rd.pos ? "on" : ""}"></i>` : ""}<b class="${i < rd.pos ? "on" : ""} ${i === rd.pos ? "here" : ""}" title="${esc(name)}">${i === rd.pos ? "🐪" : ""}</b>`).join("");
  const slot = (f, icon, title, note) => { const kid = c[f]; return `<div class="lead-slot"><span class="ls-ic">${icon}</span><div><small>${title}</small>${edit ? `<select data-act="carlead" data-car="${c.id}" data-f="${f}" aria-label="${title}"><option value="">— اختر —</option>${ks.map((k) => `<option value="${k.id}" ${kid === k.id ? "selected" : ""}>${esc(L.kidName(k))}</option>`).join("")}</select>` : `<b>${kid && I.kid[kid] ? esc(L.kidName(I.kid[kid])) : "—"}</b>`}<p class="muted small">${note}</p></div></div>`; };
  $app().innerHTML = shell(`
    <a class="back" href="#caravans">→ كل القوافل</a>
    <header class="car-hero" style="${carStyle(c)}"><div><p class="muted">قافلة</p><h1>${esc(c.name)}</h1>${c.chant ? `<p class="chant">«${esc(c.chant)}»</p>` : ""}</div>
      <div class="pp-nums"><div><b class="num">${t.stars}</b><span>نجوم</span></div><div><b class="num">${ks.length}</b><span>أعضاء</span></div><div><b class="num">${L.freeCards(S, c.id).length}</b><span>بطاقات</span></div><div><b class="num">${t.bal}</b><span>رصيد</span></div></div></header>
    <section class="panel"><h3>القيادة</h3>
      <div class="lead-slots">${slot("leader_kid", "🎖️", "قائد القافلة", "ثابت، ويتغير بقرارك")}${slot("deputy_kid", "🔰", "نائب القائد", "يساند القائد ويقوم مقامه")}${slot("captain_kid", "⚽", "كابتن الدوري", "يمثل القافلة في الملعب")}</div>
      <div class="lead-creed"><p class="lc-verse">${L.LEAD.verse}</p><p class="lc-motto">${esc(L.LEAD.motto)}</p>
        <div class="grid2"><div><b>🎖️ القائد</b><ul>${L.LEAD.leader.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><b>🔰 النائب</b><ul>${L.LEAD.deputy.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div></div></section>
    ${m ? `<section class="panel"><h3>هذا اللقاء</h3><div class="this-meet"><span>${r.stars === 2 ? "🌟 نجمة ذهبية" : r.stars ? "⭐ نجمة" : `جاهزون للنجمة <b class="num">${r.ready}/${r.n}</b>`}</span>${d ? `<span>${d.icon} ${esc(d.name)} ${L.dutyMastered(S, m.id, c.id) ? "✅" : ""}</span>` : ""}<span>إتقان التكليف <b class="num">${L.dutyCount(S, c.id, m.id) % 2}/2</b> للنجمة</span></div></section>` : ""}
    <section class="panel"><h3>الأعضاء</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>المغامر</th><th>دوره هذا اللقاء</th><th>المستوى</th><th>المجموع</th></tr></thead><tbody>
      ${ks.map((k) => { const ro = m ? L.roleOf(S, k, m.number) : null; const tot = L.kidTotal(S, I, k.id); const lv = L.level(tot); const tags = L.leaderOf(S, k.id).map((x) => `<span class="ltag ${x[0]}">${x[1]} ${x[2]}</span>`).join(" ");
        return `<tr><td><a href="#kid/${k.id}">${esc(L.kidName(k))}</a> ${tags}${k.position ? ` <small class="muted">${esc(L.POSITIONS[k.position])}</small>` : ""}</td><td>${ro ? esc(ro[1]) : "—"}</td><td>${lv.icon} ${esc(lv.name)}</td><td class="num">${tot}</td></tr>`; }).join("") || '<tr><td colspan="4" class="muted">لا يوجد أعضاء</td></tr>'}
      </tbody></table></div></section>
    <section class="panel"><h3>الطريق</h3><div class="road big-road">${road}</div><p>📍 <b>${esc(L.ROAD[rd.pos])}</b>${rd.last ? ` · 🎁 آخر مكافأة: <b>${esc(L.PERKS[rd.last.pos].name)}</b>: ${esc(L.PERKS[rd.last.pos].what)}` : ""}</p>${nx ? `<p class="muted small">المحطة القادمة «${esc(L.ROAD[rd.pos + 1])}» تفتح: ${esc(nx.name)}</p>` : ""}</section>
    <section class="panel"><h3>🎴 بطاقات القوة</h3><div class="pc-row">${L.freeCards(S, c.id).map((p) => pcardHTML(p.kind)).join("") || '<span class="muted">لا بطاقات حاليًا.</span>'}</div><p><a class="btn sm ghost" href="#cards">إدارة البطاقات</a></p></section>
    <section class="panel"><h3>هوية القافلة</h3>${edit ? `<div class="cform"><label>الاسم<input id="cn-${c.id}" value="${esc(c.name)}" maxlength="20"></label><label>اللون<input id="cc-${c.id}" type="color" value="${esc(c.color)}"></label>
        <label class="wide">الصيحة<input id="ch-${c.id}" value="${esc(c.chant || "")}" maxlength="60" placeholder="3 كلمات"></label>
        <label class="wide">الميثاق<textarea id="ct-${c.id}" rows="2" maxlength="300" placeholder="3 قواعد اتفقت عليها القافلة">${esc(c.charter || "")}</textarea></label>
        <button class="btn sm" data-act="carsave" data-id="${c.id}">حفظ</button></div>` : `${c.charter ? `<p><b>الميثاق:</b> ${esc(c.charter)}</p>` : '<p class="muted">—</p>'}`}</section>`, "caravan");
}

// ---------------- kids ----------------
function viewKids() {
  const edit = can("kids");
  let list = S.kids.slice().sort((a, b) => (b.active - a.active) || a.first_name.localeCompare(b.first_name, "ar"));
  if (ui.kidsQ) list = list.filter((k) => L.kidName(k).includes(ui.kidsQ));
  if (ui.kidsCar !== "all") list = list.filter((k) => String(k.caravan_id) === ui.kidsCar || (ui.kidsCar === "none" && !k.caravan_id));
  const carOpts = (sel) => `<option value="">بدون قافلة</option>` + S.caravans.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const posOpts = (sel) => `<option value="">—</option>` + Object.entries(L.POSITIONS).map(([v, t]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${t}</option>`).join("");
  const unofficial = S.kids.filter((k) => k.active && !k.official).length;
  const traitOpts = (sel) => `<option value="">—</option>` + [["ق", "قائد"], ["ت", "متعاون"], ["ح", "حماسي"], ["ه", "هادئ"]].map(([v, t]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${v} ${t}</option>`).join("");
  $app().innerHTML = shell(`
    <section class="bar"><h1 class="h1">المغامرون <small class="muted num">${L.activeKids(S).length} نشط</small></h1></section>
    ${unofficial ? `<p class="alert">${unofficial} مغامر يحضر وهو غير مسجّل في منصة النادي الرسمية (مكتوب جنبه «غير مسجّل»). تابع تسجيلهم ودفع الرسوم مع الإدارة.</p>` : ""}
    ${edit ? `<section class="panel"><h3>إضافة مغامر</h3><div class="addrow"><input id="nk-first" placeholder="الاسم الأول" maxlength="30" aria-label="الاسم الأول"><input id="nk-fam" placeholder="اسم العائلة" maxlength="30" aria-label="اسم العائلة"><select id="nk-car" aria-label="القافلة">${carOpts(null)}</select><button class="btn" data-act="kidadd">إضافة</button></div><p class="muted small">نحفظ الاسم فقط. بيانات ولي الأمر والصحة تبقى في المنصة الرسمية.</p></section>` : ""}
    <div class="filters"><input id="kq" type="search" placeholder="ابحث بالاسم" value="${esc(ui.kidsQ)}" aria-label="بحث"><select id="kcar" aria-label="تصفية بالقافلة"><option value="all">كل القوافل</option>${S.caravans.map((c) => `<option value="${c.id}" ${ui.kidsCar === String(c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}<option value="none" ${ui.kidsCar === "none" ? "selected" : ""}>بدون قافلة</option></select></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المغامر</th><th>القافلة</th><th>المركز</th><th>الحرف</th><th>المجموع</th><th>الحضور</th>${edit ? "<th>تعديل</th>" : ""}</tr></thead><tbody>
    ${list.map((k) => { const at = L.kidAttendance(S, I, k.id); if (edit && ui.editKid === k.id) return `<tr><td colspan="7"><div class="addrow"><input id="ek-first" value="${esc(k.first_name)}" maxlength="30" aria-label="الاسم الأول"><input id="ek-fam" value="${esc(k.family_name)}" maxlength="30" aria-label="اسم العائلة"><label class="chk"><input id="ek-off" type="checkbox" ${k.official ? "checked" : ""}> مسجّل في المنصة الرسمية</label><button class="btn sm" data-act="kidsave" data-id="${k.id}">حفظ</button><button class="btn ghost sm" data-act="kidedit" data-id="">إلغاء</button><button class="btn danger sm" data-act="kiddel" data-id="${k.id}">حذف المغامر نهائيًا</button></div></td></tr>`;
      return `<tr class="${k.active ? "" : "inactive"}"><td><a href="#kid/${k.id}">${esc(L.kidName(k))}</a>${k.official ? "" : ' <span class="tag">غير مسجّل</span>'}</td>
      <td>${edit ? `<select data-act="kidcar" data-id="${k.id}" aria-label="قافلة ${esc(k.first_name)}">${carOpts(k.caravan_id)}</select>` : esc(carName(k.caravan_id))}</td>
      <td>${edit ? `<select data-act="kidpos" data-id="${k.id}" aria-label="مركز ${esc(k.first_name)}">${posOpts(k.position)}</select>` : esc(L.POSITIONS[k.position] || "—")}</td>
      <td>${edit ? `<select data-act="kidtrait" data-id="${k.id}" aria-label="حرف ${esc(k.first_name)}">${traitOpts(k.trait)}</select>` : esc(k.trait || "—")}</td>
      <td class="num">${L.kidTotal(S, I, k.id)}</td><td class="num">${at.total ? at.came + "/" + at.total : "—"}</td>
      ${edit ? `<td class="nowrap"><button class="btn ghost sm" data-act="kidedit" data-id="${k.id}">الاسم</button> <button class="btn ghost sm" data-act="kidactive" data-id="${k.id}">${k.active ? "إيقاف" : "تفعيل"}</button></td>` : ""}</tr>`; }).join("") || `<tr><td colspan="7" class="muted">لا نتائج</td></tr>`}
    </tbody></table></div>`, "kids");
  const q = document.getElementById("kq"); q.oninput = () => { ui.kidsQ = q.value.trim(); clearTimeout(q._t); q._t = setTimeout(() => { viewKids(); const n = document.getElementById("kq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  document.getElementById("kcar").onchange = (e) => { ui.kidsCar = e.target.value; viewKids(); };
}

// ---------------- passport ----------------
function viewKid(id) {
  const k = I.kid[id]; if (!k) return ($app().innerHTML = shell('<div class="empty">المغامر غير موجود. <a href="#kids">رجوع للقائمة</a></div>', "kids"));
  const edit = can("passport"); const c = I.car[k.caravan_id];
  const tot = L.kidTotal(S, I, k.id); const at = L.kidAttendance(S, I, k.id);
  const lv = L.level(tot);
  const catTot = L.CATS.map((cat) => [cat, S.points.filter((p) => p.kid_id === k.id && p[cat[0]]).length]);
  const stamps = S.meetings.map((m) => {
    const rec = L.recorded(I, m.id, k.id); const pr = L.present(I, m.id, k.id); const n = L.net(I, m.id, k.id); const t = k.caravan_id ? L.teamMeet(S, I, m.id, k.caravan_id) : { stars: 0 };
    const cls = !rec ? "future" : pr ? "came" : "missed";
    return `<div class="stamp ${cls}"><b>${m.number}</b><small>${fmtDate(m.meet_date)}</small>${rec ? (pr ? `<span class="num">${n} نقاط</span>${t.stars ? `<em>${t.stars === 2 ? "🌟" : "⭐"}</em>` : ""}` : "<span>غائب</span>") : ""}${m.skill ? `<i>${esc(m.skill)}</i>` : ""}</div>`;
  }).join("");
  const bs = S.badges.filter((b) => b.kid_id === k.id);
  const ms = Object.fromEntries(S.measures.filter((x) => x.kid_id === k.id).map((x) => [x.test + "|" + x.phase, x.value]));
  const notes = S.kid_notes.filter((n) => n.kid_id === k.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const goals = S.goals.filter((g) => g.kid_id === k.id).length;
  const blue = L.cardCount(S, k.id, "blue"), yel = L.cardCount(S, k.id, "yellow"), red = L.cardCount(S, k.id, "red");
  const spirit = S.league_rounds.filter((r) => r.spirit_kid === k.id).length + S.matches.filter((x) => x.spirit_kid === k.id).length;
  $app().innerHTML = shell(`
    <article class="passport" style="${carStyle(c)}">
      <header class="pp-head"><div><p class="muted">جواز المغامر</p><h1>${esc(L.kidName(k))}</h1><p>${c ? "قافلة " + esc(c.name) : "بدون قافلة"}${k.active ? "" : " · موقوف"}</p></div>
        <div class="pp-nums"><div><b class="num">${tot}</b><span>نقطة</span></div><div><b>${lv.icon}</b><span>${esc(lv.name)}</span></div><div><b class="num">${at.total ? at.came + "/" + at.total : "—"}</b><span>حضور</span></div></div></header>
      <section class="lvl-card"><div class="lvl-steps">${L.LEVELS.map((x, i) => `<span class="${i <= lv.i ? "on" : ""} ${i === lv.i ? "here" : ""}"><b>${x.icon}</b>${esc(x.name)}<small class="num">${x.min}+</small></span>`).join("")}</div>
        <div class="prog lvl-prog"><i style="width:${lv.pct}%"></i></div><p class="muted small">${lv.next ? `باقي <b class="num">${lv.toNext}</b> نقطة ويصير «${esc(lv.next.name)}» ${lv.next.icon}` : "وصل أعلى مستوى في الطريق 🏇"} · المقارنة مع نفسه فقط</p></section>
      <section><h2 class="h2">أختام اللقاءات</h2><div class="stamps">${stamps}</div></section>
      <section><h2 class="h2">بطاقاته</h2><div class="cat-bars">${catTot.map(([cat, n]) => `<div><span>${cat[1]}</span><div class="cbar"><i style="width:${Math.min(100, (n / Math.max(1, S.meetings.length)) * 100)}%;background:${cat[2]}"></i></div><b class="num">${n}</b></div>`).join("")}</div></section>
      <section><h2 class="h2">الشارات</h2>${bs.length ? `<ul class="badges">${bs.map((b) => `<li><b>${esc(L.BADGES[b.badge])}</b><span>${esc(b.evidence)}</span>${b.meeting_id && I.meet[b.meeting_id] ? `<small>اللقاء ${I.meet[b.meeting_id].number}</small>` : ""}${edit ? `<button class="x" data-act="badgedel" data-id="${b.id}" aria-label="حذف الشارة">×</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted">لم يحصل على شارة بعد. كل شارة تُعطى بشاهد سلوك أو إنجاز.</p>'}
        ${edit ? `<div class="addrow"><select id="bd-type" aria-label="الشارة">${Object.entries(L.BADGES).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select><input id="bd-ev" placeholder="الشاهد: موقف أو إنجاز محدد" maxlength="140" aria-label="الشاهد"><button class="btn" data-act="badgeadd" data-k="${k.id}">منح الشارة</button></div>` : ""}</section>
      <section><h2 class="h2">خماسي القدرات: قبل وبعد</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>القدرة</th><th>قبل</th><th>بعد</th><th>التحسّن</th></tr></thead><tbody>
        ${Object.entries(L.TESTS).map(([t, info]) => { const pre = ms[t + "|pre"], post = ms[t + "|post"]; let imp = "—"; if (pre != null && post != null) { const d = info.lowerBetter ? pre - post : post - pre; imp = d > 0 ? `<span class="up">▲ ${+d.toFixed(2)} ${info.unit}</span>` : d < 0 ? `<span class="down">▼ ${+Math.abs(d).toFixed(2)}</span>` : "ثابت"; }
          const cell = (ph, v) => edit ? `<input class="mini num" type="number" step="0.1" inputmode="decimal" value="${v ?? ""}" data-act="measure" data-k="${k.id}" data-t="${t}" data-p="${ph}" aria-label="${info.name} ${ph === "pre" ? "قبل" : "بعد"}">` : `<span class="num">${v ?? "—"}</span>`;
          return `<tr><td>${info.name}<small class="muted"> (${info.unit})</small></td><td>${cell("pre", pre)}</td><td>${cell("post", post)}</td><td>${imp}</td></tr>`; }).join("")}
      </tbody></table></div><p class="muted small">السرعة والرشاقة: الأقل أفضل. الباقي: الأكثر أفضل. المقارنة مع نفسه فقط.</p></section>
      ${(() => { const ks = (S.duty_log || []).filter((d) => d.speaker_kid === k.id); return ks.length ? `<section><h2 class="h2">🎙️ منبر القافلة</h2><ul class="badges">${ks.map((d) => `<li><b>اللقاء ${I.meet[d.meeting_id] ? I.meet[d.meeting_id].number : ""}</b><span>${d.topic != null ? esc(L.TOPICS[d.topic].t) : "كلمة بعد الصلاة"}</span></li>`).join("")}</ul></section>` : ""; })()}
      <section><h2 class="h2">في الدوري</h2><div class="league-me"><span>⚽ أهداف <b class="num">${goals}</b></span><span>🟦 أمانة <b class="num">${blue}</b></span><span>🟨 <b class="num">${yel}</b></span><span>🟥 <b class="num">${red}</b></span><span>🏅 روح رياضية <b class="num">${spirit}</b></span></div></section>
      <section><h2 class="h2">كلمة المشرف</h2>${notes.length ? `<ul class="notes">${notes.map((n) => `<li><p>${esc(n.body)}</p><small>${n.created_at.slice(0, 10)}</small>${edit ? `<button class="x" data-act="notedel" data-id="${n.id}" aria-label="حذف">×</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted">لا توجد كلمات بعد.</p>'}
        ${edit ? `<div class="addrow"><input id="nt-body" placeholder="سطر تشجيع أو ملاحظة تقدّم" maxlength="240" aria-label="كلمة المشرف"><button class="btn" data-act="noteadd" data-k="${k.id}">إضافة</button></div>` : ""}</section>
      <div class="row-btns no-print"><button class="btn ghost" data-act="print">طباعة الجواز / حفظ PDF</button><a class="btn ghost" href="#kids">رجوع للمغامرين</a></div>
    </article>`, "kids");
}

// ---------------- league ----------------
function viewLeague() {
  const edit = can("league");
  const tabs = [["matches", "المباريات"], ["table", "الترتيب"], ["awards", "الجوائز"]];
  let body = "";
  if (ui.leagueTab === "matches") {
    const rounds = [...new Set(S.matches.map((m) => m.round))].sort((a, b) => a - b);
    body = rounds.map((r) => {
      const ms = S.matches.filter((m) => m.round === r);
      const meet = ms[0] && I.meet[ms[0].meeting_id];
      const lr = S.league_rounds.find((x) => x.round === r);
      const kidsIn = ms.flatMap((m) => [...L.kidsOf(S, m.home_id), ...L.kidsOf(S, m.away_id)]);
      return `<section class="round"><header><h3>الجولة ${r}${ms[0] && ms[0].stage !== "league" ? " · " + (ms[0].stage === "final" ? "النهائي" : "المركز الثالث") : ""}</h3><span class="muted">${meet ? "اللقاء " + meet.number + " · " + fmtDate(meet.meet_date) : ""}</span></header>
        ${ms.map((m) => matchCard(m, edit)).join("")}
        <div class="spirit-round"><span>🏅 لاعب الروح الرياضية للجولة</span>${edit ? `<select data-act="roundspirit" data-r="${r}" aria-label="لاعب الروح للجولة ${r}"><option value="">—</option>${kidsIn.map((k) => `<option value="${k.id}" ${lr && lr.spirit_kid === k.id ? "selected" : ""}>${esc(L.kidName(k))}</option>`).join("")}</select>` : `<b>${lr && lr.spirit_kid ? esc(L.kidName(I.kid[lr.spirit_kid])) : "—"}</b>`}</div>
      </section>`;
    }).join("") + (edit ? `<div class="row-btns"><button class="btn ghost" data-act="addfinal">إضافة النهائي ومباراة المركز الثالث (من الترتيب الحالي)</button></div>` : "");
  } else if (ui.leagueTab === "table") {
    const st = L.standings(S);
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>القافلة</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>الفارق</th><th>لعب نظيف</th><th>النقاط</th></tr></thead><tbody>${st.map((s, i) => `<tr><td class="num">${i + 1}</td><td><span class="sw" style="${carStyle(I.car[s.id])}"></span>${esc(carName(s.id))}</td><td class="num">${s.p}</td><td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf}</td><td class="num">${s.ga}</td><td class="num">${s.gf - s.ga}</td><td class="num">${s.fair}</td><td class="num"><b>${s.pts}</b></td></tr>`).join("")}</tbody></table></div>
      <p class="muted small">فوز 3، تعادل 1، ونقطة لعب نظيف يعطيها الحكم لكل قافلة لم تعترض ولم تتعمد الخشونة. نقاط الدوري تدخل في رصيد القافلة.</p>`;
  } else {
    const st = L.standings(S); const sc = L.scorers(S); const kp = L.keepers(S); const sp = L.spiritRace(S, I);
    const fin = S.matches.find((m) => m.stage === "final" && m.played);
    const champ = fin ? (fin.home_goals > fin.away_goals ? fin.home_id : fin.away_goals > fin.home_goals ? fin.away_id : null) : null;
    const award = (icon, title, who, how, list) => `<section class="award"><header><span class="ic">${icon}</span><div><h3>${title}</h3><p class="muted small">${how}</p></div></header><p class="lead-name">${who}</p>${list}</section>`;
    body = `<div class="awards">
      ${award("🏆", "كأس بطل الدوري", champ ? esc(carName(champ)) : st[0] && st[0].p ? "المتصدر الآن: " + esc(carName(st[0].id)) : "—", "القافلة الفائزة في النهائي. قبل النهائي يظهر المتصدر.", "")}
      ${award("⚽", "كأس هداف الدوري", sc[0] ? esc(L.kidName(I.kid[sc[0].kid])) + ` <span class="num">(${sc[0].n})</span>` : "—", "أكثر مغامر سجّل أهدافًا.", sc.length ? `<ol class="race">${sc.slice(0, 5).map((x) => `<li>${esc(L.kidName(I.kid[x.kid]))}<b class="num">${x.n}</b></li>`).join("")}</ol>` : "")}
      ${award("🧤", "كأس أفضل حارس", kp[0] ? esc(L.kidName(I.kid[kp[0].kid])) : "—", "أكثر مباريات بشباك نظيفة، ثم أقل معدل أهداف. اختر حارس كل قافلة في المباراة.", kp.length ? `<ol class="race">${kp.slice(0, 5).map((x) => `<li>${esc(L.kidName(I.kid[x.kid]))}<b class="num">${x.clean} نظيفة · ${x.games} مباراة</b></li>`).join("")}</ol>` : "")}
      ${award("🏅", "كأس أفضل لاعب (الروح الرياضية)", sp[0] ? esc(L.kidName(I.kid[sp[0].kid])) : "—", "لا يعتمد على المهارة: لاعب روح الجولة +3، لاعب روح المباراة +2، بطاقة زرقاء +2، نقطة روح رياضية في اللقاء +1، صفراء −1، حمراء −3.", sp.length ? `<ol class="race">${sp.slice(0, 5).map((x) => `<li>${esc(L.kidName(I.kid[x.kid]))}<b class="num">${x.pts}</b></li>`).join("")}</ol>` : "")}
    </div>`;
  }
  $app().innerHTML = shell(`<section class="bar"><h1 class="h1">دوري القوافل</h1><div class="seg" role="group" aria-label="أقسام الدوري">${tabs.map((t) => `<button data-act="ltab" data-v="${t[0]}" aria-pressed="${ui.leagueTab === t[0]}">${t[1]}</button>`).join("")}</div></section>
    <p class="muted small cardkey">🟨 صفراء · 🟥 حمراء · 🟦 زرقاء للأمانة: لمن يعترف إن الكورة لمست يده أو طلعت برا.</p>${body}`, "league");
}
function matchCard(m, edit) {
  const h = I.car[m.home_id], a = I.car[m.away_id]; if (!h || !a) return "";
  const open = ui.openMatch === m.id;
  const goals = S.goals.filter((g) => g.match_id === m.id); const cards = S.cards.filter((c) => c.match_id === m.id);
  const side = (cid) => goals.filter((g) => I.kid[g.kid_id] && I.kid[g.kid_id].caravan_id === cid);
  const both = [...L.kidsOf(S, m.home_id), ...L.kidsOf(S, m.away_id)];
  const kidOpt = (list, sel) => `<option value="">—</option>` + list.map((k) => `<option value="${k.id}" ${sel === k.id ? "selected" : ""}>${esc(L.kidName(k))}</option>`).join("");
  const scoreTxt = m.played ? `<b class="num">${m.home_goals ?? 0}</b><span>–</span><b class="num">${m.away_goals ?? 0}</b>` : `<span class="muted">لم تُلعب</span>`;
  return `<div class="match ${m.played ? "done" : ""}">
    <button class="mhead" data-act="mopen" data-id="${m.id}" aria-expanded="${open}">
      <span class="team" style="${carStyle(h)}">${esc(h.name)}${m.fair_home ? " ✓" : ""}</span><span class="score">${scoreTxt}</span><span class="team" style="${carStyle(a)}">${esc(a.name)}${m.fair_away ? " ✓" : ""}</span></button>
    <div class="mmeta">${side(m.home_id).concat(side(m.away_id)).map((g) => `⚽ ${esc(I.kid[g.kid_id].first_name)}`).join(" · ")}${cards.length ? " " + cards.map((c) => `${c.color === "blue" ? "🟦" : c.color === "yellow" ? "🟨" : "🟥"} ${esc(I.kid[c.kid_id] ? I.kid[c.kid_id].first_name : "")}`).join(" · ") : ""}${m.spirit_kid && I.kid[m.spirit_kid] ? ` · 🏅 ${esc(I.kid[m.spirit_kid].first_name)}` : ""}${(S.power_cards || []).filter((p) => p.used_match_id === m.id).map((p) => ` · ${esc(L.POWER[p.kind].name)} (${esc(carName(p.caravan_id))})`).join("")}</div>
    ${open && edit ? `<div class="medit">
      <div class="grid2"><label>الفريق الأول<select id="mth-${m.id}">${S.caravans.map((c) => `<option value="${c.id}" ${c.id === m.home_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>الفريق الثاني<select id="mta-${m.id}">${S.caravans.map((c) => `<option value="${c.id}" ${c.id === m.away_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div>
      <div class="grid2"><label>الجولة<input id="mr-${m.id}" type="number" min="1" max="20" value="${m.round}"></label><label>اللقاء<select id="mm-${m.id}">${S.meetings.map((x) => `<option value="${x.id}" ${x.id === m.meeting_id ? "selected" : ""}>اللقاء ${x.number} · ${fmtDate(x.meet_date)}</option>`).join("")}</select></label></div>
      <div class="scoreline"><label>${esc(h.name)}<input id="mh-${m.id}" type="number" min="0" max="50" inputmode="numeric" value="${m.home_goals ?? ""}"></label><label>${esc(a.name)}<input id="ma-${m.id}" type="number" min="0" max="50" inputmode="numeric" value="${m.away_goals ?? ""}"></label></div>
      <div class="grid2"><label>حارس ${esc(h.name)}<select id="mkh-${m.id}">${kidOpt(L.kidsOf(S, m.home_id), m.home_keeper)}</select></label><label>حارس ${esc(a.name)}<select id="mka-${m.id}">${kidOpt(L.kidsOf(S, m.away_id), m.away_keeper)}</select></label></div>
      <div class="grid2"><label class="chk"><input id="mfh-${m.id}" type="checkbox" ${m.fair_home ? "checked" : ""}> لعب نظيف لـ${esc(h.name)} (+1)</label><label class="chk"><input id="mfa-${m.id}" type="checkbox" ${m.fair_away ? "checked" : ""}> لعب نظيف لـ${esc(a.name)} (+1)</label></div>
      <div class="grid2">${[[h, "mph"], [a, "mpa"]].map(([cc, pid]) => { const cur = L.cardFor(S, m.id, cc.id); const opts = (cur ? [cur] : []).concat(L.freeCards(S, cc.id));
        return `<label>🎴 بطاقة قوة ${esc(cc.name)}<select id="${pid}-${m.id}"><option value="">بدون</option>${opts.map((p) => `<option value="${p.id}" ${cur && cur.id === p.id ? "selected" : ""}>${esc(L.POWER[p.kind].name)}</option>`).join("")}</select></label>`; }).join("")}</div>
      <label>🏅 لاعب الروح الرياضية في المباراة<select id="msp-${m.id}">${kidOpt(both, m.spirit_kid)}</select></label>
      <div class="row-btns"><button class="btn" data-act="msave" data-id="${m.id}">حفظ النتيجة</button><button class="btn danger sm" data-act="matchdel" data-id="${m.id}">حذف المباراة</button></div>
      <div class="sub"><h4>الأهداف</h4><ul class="mini-list">${goals.map((g) => `<li>⚽ ${esc(L.kidName(I.kid[g.kid_id]))}<button class="x" data-act="goaldel" data-id="${g.id}" aria-label="حذف الهدف">×</button></li>`).join("") || '<li class="muted">لا أهداف</li>'}</ul>
        <div class="addrow"><select id="mg-${m.id}" aria-label="من سجّل">${kidOpt(both)}</select><button class="btn sm" data-act="goaladd" data-id="${m.id}">+ هدف</button></div></div>
      <div class="sub"><h4>البطاقات</h4><ul class="mini-list">${cards.map((c) => `<li>${c.color === "blue" ? "🟦 أمانة" : c.color === "yellow" ? "🟨 صفراء" : "🟥 حمراء"} · ${esc(L.kidName(I.kid[c.kid_id]))}${c.reason ? " · " + esc(c.reason) : ""}<button class="x" data-act="carddel" data-id="${c.id}" aria-label="حذف البطاقة">×</button></li>`).join("") || '<li class="muted">لا بطاقات</li>'}</ul>
        <div class="addrow"><select id="mck-${m.id}" aria-label="اللاعب">${kidOpt(both)}</select><select id="mcc-${m.id}" aria-label="لون البطاقة"><option value="blue">🟦 زرقاء (أمانة)</option><option value="yellow">🟨 صفراء</option><option value="red">🟥 حمراء</option></select><input id="mcr-${m.id}" placeholder="السبب (اختياري)" maxlength="80" aria-label="السبب"><button class="btn sm" data-act="cardadd" data-id="${m.id}">+ بطاقة</button></div></div>
    </div>` : ""}
  </div>`;
}

// ---------------- طريق القوافل ----------------
function pcardHTML(kind, big) {
  const p = L.POWER[kind]; if (!p) return "";
  return powerCard(kind, big ? "md" : "sm");
}
function revealHTML(rv, closable) {
  const c = I.car[rv.car];
  return `<div class="reveal" style="${carStyle(c)}" ${closable ? 'data-act="revealclose"' : ""} role="dialog" aria-label="بطاقة قوة جديدة"><div class="reveal-in"><p class="reveal-k">بطاقة قوة جديدة لقافلة</p><h2>${esc(c ? c.name : "")}</h2>${drawStage(rv.kind, false)}${closable ? '<button class="btn ghost">تم</button>' : ""}</div></div>`;
}
function powerBar(c, m) {
  const free = L.freeCards(S, c.id);
  if (!free.length) return "";
  return `<div class="pw-bar"><span class="pw-have">🎴 بطاقات القافلة: ${free.length ? free.map((p) => `<span class="pw-chip t${L.POWER[p.kind].tier}">${esc(L.POWER[p.kind].name)}${p.meeting_id === m.id && can("points") ? ` <button class="x" data-act="carddrawdel" data-id="${p.id}" aria-label="حذف السحبة">×</button>` : ""}</span>`).join("") : '<span class="muted">لا شيء</span>'}</span>
    <a class="btn sm ghost" href="#cards">🎴 البطاقات</a></div>`;
}
function kalimaPick(c, m) {
  const d = L.dutyRow(S, m.id, c.id) || {}; const used = L.usedTopics(S, m.id, c.id);
  const spk = L.kidsOf(S, c.id).map((k) => { const okk = L.canSpeak(S, c.id, k.id, m.id) || d.speaker_kid === k.id; return `<option value="${k.id}" ${d.speaker_kid === k.id ? "selected" : ""} ${okk ? "" : "disabled"}>${esc(L.kidName(k))}${okk ? "" : " (تكلّم قبل)"}</option>`; }).join("");
  const tps = L.TOPICS.map((tp, i) => `<option value="${i}" ${d.topic === i ? "selected" : ""} ${used.has(i) && d.topic !== i ? "disabled" : ""}>${i + 1}. ${esc(tp.t)}${used.has(i) && d.topic !== i ? " (قُدّم)" : ""}</option>`).join("");
  return `<label>المتحدث (تختاره القافلة)<select data-act="dutyspk" data-mid="${m.id}" data-car="${c.id}"><option value="">—</option>${spk}</select></label>
    <label>الموضوع من البنك<select data-act="dutytopic" data-mid="${m.id}" data-car="${c.id}"><option value="">—</option>${tps}</select></label>`;
}
function dutyBar(c, m) {
  const d = L.dutyOf(S, m, c.id); if (!d) return "";
  const done = L.dutyMastered(S, m.id, c.id); const cnt = L.dutyCount(S, c.id, m.id); const star = L.dutyStarAt(S, m.id, c.id);
  const ed = can("points");
  return `<div class="duty-bar ${done ? "ok" : ""}"><div class="duty-main"><span class="duty-name">${d.icon} ${esc(d.name)}</span>
      <small class="muted">${d.tasks.map(esc).join(" · ")}</small></div>
    <div class="duty-act">${ed ? `<button class="chip dchip" data-act="duty" data-car="${c.id}" data-mid="${m.id}" aria-pressed="${done}">${done ? "✅ أتقنوا التكليف" : "أتقنوا التكليف؟"}</button>` : done ? "✅ أُتقن" : ""}
      <small class="num">${star ? "⭐ نجمة تكليف!" : `الإتقان ${cnt % 2}/2 للنجمة`}</small></div>
    ${d.key === "kalima" && ed ? `<div class="duty-kal">${kalimaPick(c, m)}</div>` : ""}</div>`;
}
const nextMeeting = (m) => S.meetings.find((x) => x.number === (m.number || 0) + 1) || null;
function newLevels(m) {
  return L.activeKids(S).map((k) => { const tot = L.kidTotal(S, I, k.id); const before = tot - L.net(I, m.id, k.id); const a = L.level(before), b = L.level(tot); return b.i > a.i ? { k, lv: b } : null; }).filter(Boolean);
}
const DUTY_TONE = { musalla: "#1fa865", kalima: "#0a63e6", food: "#ef8a33", clean: "#e7297a" };
const LVL_TONE = ["#6b7cff", "#1fa865", "#0a63e6", "#ef8a33", "#e7297a", "#d4a106"];
function printCards() {
  const pc = (kind) => `<div class="pp-cell">${powerCard(kind)}</div>`;
  const duty = (d) => `<div class="pp-duty" style="--dt:${DUTY_TONE[d.key]}"><header class="pd-head"><small>تكليف القافلة</small><h3>${esc(d.name)}</h3></header><div class="pd-medal">${d.icon}</div>
      <div class="pd-body"><p class="pd-k">الإتقان يعني</p><ul>${d.tasks.map((t) => `<li><i></i>${esc(t)}</li>`).join("")}</ul></div>
      <footer class="pd-f"><b>⭐</b> كل إتقانين = نجمة للقافلة</footer></div>`;
  const lvl = (lv, name) => `<div class="pp-lvl" style="--lt:${LVL_TONE[lv.i]}"><div class="pl-side"><div class="pl-medal">${lv.icon}</div><div class="pl-ladder">${L.LEVELS.map((_, i) => `<i class="${i <= lv.i ? "on" : ""}"></i>`).join("")}</div></div>
      <div class="pl-main"><small>لقب جديد في طريق القوافل</small><h3>${esc(lv.name)}</h3><p>${esc(lv.what)}</p>
      <div class="pl-name"><span>${name ? esc(name) : ""}</span></div><div class="pl-sign"><span>المستوى ${lv.i + 1} من ${L.LEVELS.length}</span><span>نادي مهارة · المغامرون</span></div></div></div>`;
  const topic = (i, who) => { const tp = L.TOPICS[i]; return `<div class="pp-topic ${tp.c}"><header class="pt-head"><span class="pt-cat">${L.TOPIC_CATS[tp.c]}</span><span class="pt-n">${String(i + 1).padStart(2, "0")}</span></header>
      <h3>${esc(tp.t)}</h3><p class="pt-s">${esc(tp.s)}</p><div class="pt-q"><b>اسأل الحضور</b>${esc(tp.q)}</div>
      <footer class="pt-f"><span>🎙️ منبر القافلة · ⏱️ 3 دقائق</span><span class="pt-who">${who ? esc(who) : "المتحدث: ............"}</span></footer></div>`; };
  const lead = (dep) => `<div class="pp-lead ${dep ? "dep" : ""}"><header><span class="pl-badge">${dep ? "🔰" : "🎖️"}</span><div><small>طريق القوافل</small><h3>${dep ? "نائب القائد" : "قائد القافلة"}</h3></div></header>
      <ul>${(dep ? L.LEAD.deputy : L.LEAD.leader).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="pl-motto">${L.LEAD.verse}<br><b>${esc(L.LEAD.motto)}</b></p><div class="pl-name"><span>قافلة: ............ · الاسم: ............</span></div></div>`;
  return { pc, duty, lvl, topic, lead };
}
function viewPrint(arg) {
  const m = I.meet[meetId]; const { pc, duty, lvl, topic, lead } = printCards();
  let title, guide, sheets;
  const deck = Object.entries(L.DECK).flatMap(([k, n]) => Array(n).fill(k));
  if (arg === "deck") {
    title = "بطاقات القوة";
    guide = `<li><b>${deck.length} بطاقة</b> في ${Math.ceil(deck.length / 9)} صفحات: برونزية ×4 لكل نوع، فضية وذهبية ×3، أسطورية ×2.</li><li>ورق مقوّى 250–300 جرام لامع أو مطفي، A4، الهوامش «بلا»، وفعّل «رسومات الخلفية».</li><li>الصفحة الأخيرة ظهر البطاقات (اختياري): اطبعها على ظهر الصفحات الثلاث إذا الطابعة تطبع وجهين.</li><li>قصّها على الخطوط، وخلها في ظرف معك. البطاقة تُسلّم للقائد بعد السحب، وترجع لك بعد المباراة.</li>`;
    sheets = `<div class="sheet cards">${deck.map(pc).join("")}</div><div class="sheet cards backs">${Array(9).fill(0).map(() => `<div class="pp-cell">${powerBack()}</div>`).join("")}</div>`;
  } else if (arg === "meet" && m) {
    const nx = nextMeeting(m); const kalNext = nx && S.caravans.find((c) => (L.dutyOf(S, nx, c.id) || {}).key === "kalima");
    const kd = kalNext && L.dutyRow(S, nx.id, kalNext.id);
    const lv = newLevels(m);
    title = `بطاقات اللقاء ${m.number}`;
    guide = `<li>بطاقات المستويات الجديدة بالأسماء: <b>${lv.length}</b></li><li>بطاقة موضوع كلمة اللقاء القادم: <b>${kd && kd.topic != null ? 1 : 0}</b>${kd && kd.topic != null ? "" : " (اختر الموضوع من حقيبة اللقاء أولًا)"}</li><li>بطاقات القوة والتكليفات من المجموعة الثابتة، ما تحتاج تطبعها كل مرة.</li>`;
    sheets = lv.length ? `<div class="sheet lvls">${lv.map((x) => lvl(x.lv, L.kidName(x.k))).join("")}</div>` : "";
    if (kd && kd.topic != null) sheets += `<div class="sheet topics">${topic(kd.topic, kd.speaker_kid && I.kid[kd.speaker_kid] ? L.kidName(I.kid[kd.speaker_kid]) : "")}</div>`;
    if (!sheets) sheets = '<p class="empty">ما فيه شي يحتاج طباعة لهذا اللقاء.</p>';
  } else {
    title = "مجموعة الطباعة الثابتة";
    const blanks = [[1, 8], [2, 6], [3, 5], [4, 3], [5, 2]];
    guide = `<li><b>بطاقات القوة:</b> ${deck.length} بطاقة (3 صفحات): برونزية ×4، فضية وذهبية ×3، أسطورية ×2. تُسترد بعد كل مباراة.</li>
      <li><b>بطاقات التكليف:</b> نسختان من كل تكليف = 8 بطاقات (صفحتان). تُسلّم في الانطلاقة وتُسترد في الختام.</li>
      <li><b>بطاقات القيادة:</b> 4 قائد + 4 نائب (صفحتان). يحملها القائد والنائب، وفيها مسؤولياتهم ومبدأ «القيادة مشورة».</li>
      <li><b>بطاقات المستويات الفارغة:</b> 24 بطاقة (${blanks.map(([i, n]) => n + " " + L.LEVELS[i].name).join("، ")}) لكتابة الاسم بخط اليد احتياطًا.</li>
      <li><b>بنك مواضيع الكلمة:</b> 40 بطاقة (7 صفحات): 26 قيم ومبادئ، و14 عن المدينة المنورة.</li>
      <li>الورق: مقوّى 250–300 جرام في المطبعة، أو A4 عادي في البيت. في نافذة الطباعة: الحجم A4، الهوامش «بلا»، وفعّل «رسومات الخلفية». القص على الخطوط المتقطعة.</li>`;
    sheets = `<h2 class="pp-h">بطاقات القوة</h2><div class="sheet cards">${deck.map(pc).join("")}</div>
      <h2 class="pp-h">بطاقات التكليف</h2><div class="sheet duties">${L.DUTIES.concat(L.DUTIES).map(duty).join("")}</div>
      <h2 class="pp-h">بطاقات القيادة</h2><div class="sheet topics">${[0, 0, 0, 0, 1, 1, 1, 1].map((x) => lead(!!x)).join("")}</div>
      <h2 class="pp-h">بطاقات المستويات</h2><div class="sheet lvls">${blanks.flatMap(([i, n]) => Array(n).fill(i)).map((i) => lvl(L.level(L.LEVELS[i].min))).join("")}</div>
      <h2 class="pp-h">بنك مواضيع الكلمة</h2><div class="sheet topics">${L.TOPICS.map((_, i) => topic(i)).join("")}</div>`;
  }
  $app().innerHTML = `<div class="print-page"><header class="pr-guide no-print"><a href="#home">→ رجوع لليوم</a><h1>${title}</h1><ul>${guide}</ul><button class="btn" data-act="doprint">🖨️ طباعة / حفظ PDF</button></header>${sheets}</div>`;
}
function levelsHTML(tv) {
  const kids = L.activeKids(S).map((k) => ({ k, lv: L.level(L.kidTotal(S, I, k.id)) }));
  return `<div class="${tv ? "tv-levels" : "lv-cols"}">${L.LEVELS.map((x, i) => { const ks = kids.filter((y) => y.lv.i === i).sort((a, b) => a.k.first_name.localeCompare(b.k.first_name, "ar"));
    return `<section class="lv-col l${i}"><header><span class="lv-ic">${x.icon}</span><div><h3>${esc(x.name)}</h3><small class="num">${x.min}+ نقطة</small></div><b class="num">${ks.length}</b></header><ul>${ks.map((y) => `<li><i class="sw" style="${carStyle(I.car[y.k.caravan_id])}"></i>${esc(tv ? y.k.first_name : L.kidName(y.k))}</li>`).join("") || '<li class="muted">—</li>'}</ul></section>`; }).join("")}</div>`;
}
function sealHTML(m, tv) {
  const st = L.sealState(S, I); if (!m) return '<div class="empty">لا يوجد لقاء</div>';
  const today = st.at[m.id] || [];
  const parch = (x) => `<article class="parchment" style="${carStyle(I.car[x.cid])}"><p class="pa-car">قافلة ${esc(carName(x.cid))} وصلت «${esc(L.ROAD[x.n])}»</p><p class="pa-k">${esc(x.seal.title)}</p><p class="pa-body">${esc(x.seal.body)}</p>${x.seal.mission ? `<p class="pa-mission">مهمة الأسبوع: ${esc(x.seal.mission)}</p>` : ""}<p class="pa-sign">— الحادي</p></article>`;
  if (today.length) { const i = Math.floor(Date.now() / 20000) % today.length; return `<div class="seal-wrap opened">${parch(today[i])}${today.length > 1 ? `<p class="seal-hint">${today.length} رسائل انفتحت اليوم · تتبدّل كل 20 ثانية</p>` : ""}</div>`; }
  return `<div class="seal-wrap"><h2 class="seal-t">كل نجمة… خطوة. وكل محطة… رسالة مختومة.</h2>
    <div class="seal-grid">${S.caravans.map((c) => { const b = st.byCar[c.id]; const nx = b.next; return `<div class="seal-car" style="${carStyle(c)}"><b>${esc(c.name)}</b><div class="wax pulse small-wax"><span>${nx ? nx.n : "✓"}</span></div><small>${nx ? `الرسالة التالية في «${esc(L.ROAD[b.pos + 1])}»` : "فتحت كل الرسائل"}</small><small class="num">فتحت ${b.length} من ${st.seals.length}</small></div>`; }).join("")}</div></div>`;
}
function viewGuide() {
  const m = I.meet[meetId];
  $app().innerHTML = shell(`
    <a class="back" href="#admin">→ الإدارة</a>
    ${pageHead("دليل طريق القوافل", "قواعد النظام كاملة. تقدر تعرضها للمغامرين في وضع العرض.")}
    <section class="panel guide-hero"><p>الانضباط <b>وقود القافلة</b>: كل نجمة تقدّم الجمل محطة وتعطي القافلة سحبة بطاقة قوة، ولما تاخذ نصف القوافل نجمة ينفتح ختم الأسبوع.</p>
      <div class="g-rules"><span>⭐ كل الحاضرين ${L.NC - 1} نقاط فأكثر</span><span>🌟 الكل ${L.NC} نقاط</span><span>⭐ كل إتقانين للتكليف</span></div></section>
    <section class="panel"><h3>🎖️ القيادة: مشورة لا تسلّط</h3><p class="lc-verse">${L.LEAD.verse}</p><p><b>${esc(L.LEAD.motto)}</b></p><div class="grid2"><div><b>القائد</b><ul>${L.LEAD.leader.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><b>النائب</b><ul>${L.LEAD.deputy.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div></section>
    <section class="panel"><h3>🧭 التكليفات</h3><p class="muted small">كل قافلة لها تكليف كل لقاء، ويتبدّل تلقائيًا. الكلمة: القافلة تختار المتحدث، وما يتكرر نفس الشخص قبل ما يتكلم الكل، وما يتكرر الموضوع.</p>
      <div class="duty-grid">${L.DUTIES.map((d) => `<div class="duty-card"><b>${d.icon} ${esc(d.name)}</b><ul>${d.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")}</div>
      ${m ? `<p class="small">هذا اللقاء: ${S.caravans.map((c) => { const d = L.dutyOf(S, m, c.id); return `<span class="nowrap"><i class="sw" style="${carStyle(c)}"></i>${esc(c.name)}: ${d ? d.icon + " " + esc(d.short) : "—"}</span>`; }).join(" · ")}</p>` : ""}</section>
    <section class="panel"><h3>🎴 بطاقات القوة</h3><p class="muted small">بطاقة واحدة لكل قافلة في المباراة، يعلنها الكابتن قبل صافرة البداية.</p><div class="pc-row">${Object.keys(L.POWER).map((k) => pcardHTML(k, true)).join("")}</div></section>
    <section class="panel"><h3>🗺️ المحطات ومكافآتها</h3><ol class="perks">${L.ROAD.slice(1).map((n, i) => `<li><b>${esc(n)}</b> · ${esc(L.PERKS[i + 1].name)}: <span class="muted">${esc(L.PERKS[i + 1].what)}</span></li>`).join("")}</ol></section>
    <section class="panel"><h3>🏅 المستويات</h3><p class="muted small">من مجموع نقاط المغامر. ما فيه ترتيب: كل واحد يقارن نفسه بنفسه.</p>${levelsHTML(false)}</section>`, "guide");
}
function viewSeals() {
  const editPlan = can("plan"); const st = L.sealState(S, I);
  const seals = st.seals.map((s) => { const open = ui.openSeal === s.n; const who = S.caravans.filter((c) => st.byCar[c.id].some((x) => x.n === s.n));
    return `<li class="${who.length ? "done" : ""}"><button class="sl-head" data-act="sealopen" data-n="${s.n}" aria-expanded="${open}"><span class="sl-n">${who.length ? "📜" : "🔒"} ${s.n}</span><b>${esc(s.title)}</b><small>في «${esc(L.ROAD[s.n] || "")}» · ${who.length ? who.map((c) => `<i class="sw" style="${carStyle(c)}"></i>${esc(c.name)}`).join(" ") : "ما وصلتها قافلة"}</small></button>
      ${open ? (editPlan ? `<div class="sl-edit"><label>العنوان<input id="sl-t-${s.n}" value="${esc(s.title)}" maxlength="80"></label><label>التلميح<input id="sl-h-${s.n}" value="${esc(s.hint)}" maxlength="160"></label><label>الرسالة<textarea id="sl-b-${s.n}" rows="4" maxlength="900">${esc(s.body)}</textarea></label><label>مهمة الأسبوع<input id="sl-m-${s.n}" value="${esc(s.mission)}" maxlength="200"></label><button class="btn sm" data-act="sealsave" data-n="${s.n}">حفظ الختم</button></div>` : `<div class="sl-edit"><p>${esc(s.body)}</p><p class="muted">${esc(s.mission)}</p></div>`) : ""}</li>`; }).join("");
  $app().innerHTML = shell(`
    <a class="back" href="#admin">→ الإدارة</a>
    ${pageHead("📜 الرسائل المختومة", "عند كل محطة رسالة مختومة. كل نجمة تقدّم جمل القافلة خطوة، ولما توصل القافلة محطة تنفتح رسالتها على الشاشة. كل قافلة على طريقها، ما لها دخل بغيرها.")}
    <ol class="seals">${seals}</ol>`, "seals");
}
// ---------------- voice studio ----------------
async function loadVoices() { const xs = await storage.list("film-voice"); ui.voiceHave = new Set((xs || []).map((x) => x.name.replace(/\.\w+$/, ""))); }
function viewStudio() {
  if (!can("plan")) return go("admin");
  if (!ui.voiceHave) { $app().innerHTML = shell('<div class="empty">جاري تحميل التسجيلات…</div>', "studio"); guard(loadVoices).then(() => { if (parseRoute().name === "studio") viewStudio(); }); return; }
  const have = ui.voiceHave; const done = ALL_LINES.filter((l) => have.has(l.id)).length;
  const groups = []; for (const l of ALL_LINES) { const g = groups[groups.length - 1]; if (g && g.title === l.title) g.lines.push(l); else groups.push({ title: l.title, lines: [l] }); }
  let n = 0;
  $app().innerHTML = shell(`
    <a class="back" href="#admin">→ الإدارة</a>
    ${pageHead("🎙️ استوديو التعليق الصوتي", "سجّل صوت الراوي للفيلم جملة جملة. الفيلم يشغّل صوتك تلقائيًا، وأي جملة ما سجّلتها تطلع بصوت الجهاز.", `<a class="btn ghost sm" href="film.html" target="_blank">🎬 افتح الفيلم</a>`)}
    <section class="panel studio-tips"><div class="st-prog"><div class="prog"><i style="width:${Math.round((done / ALL_LINES.length) * 100)}%"></i></div><b class="num">${done} / ${ALL_LINES.length}</b></div>
      <ul><li>غرفة هادية، والجوال أو اللابتوب على بعد شبر من فمك.</li><li>اضغط <b>🔴 سجّل</b>، اقرأ الجملة، ثم <b>⏹ وقّف</b>. الصمت قبل وبعد ينقص تلقائيًا.</li><li>اقرأ الملاحظة تحت كل جملة: هي طريقة الأداء. والنقاط «…» يعني وقفة.</li><li>ما عجبك؟ سجّلها مرة ثانية وتنكتب فوق القديمة.</li></ul></section>
    ${groups.map((g) => `<section class="panel"><h3>${esc(g.title)}</h3><div class="lines">${g.lines.map((l) => { n++; const rec = ui.rec && ui.rec.id === l.id; const ok = have.has(l.id);
      return `<div class="line ${ok ? "ok" : ""} ${rec ? "rec" : ""}"><span class="ln num">${n}</span><div class="lt"><p>${esc(l.s)}</p>${l.n ? `<small>🎭 ${esc(l.n)}</small>` : ""}</div>
        <div class="la">${rec ? `<button class="btn danger sm" data-act="rec" data-id="${l.id}">⏹ وقّف</button>` : `<button class="btn sm ${ok ? "ghost" : ""}" data-act="rec" data-id="${l.id}" ${ui.rec ? "disabled" : ""}>🔴 ${ok ? "أعد التسجيل" : "سجّل"}</button>`}
        ${ok ? `<button class="btn ghost sm" data-act="recplay" data-id="${l.id}">▶ اسمع</button><button class="x" data-act="recdel" data-id="${l.id}" aria-label="حذف التسجيل">×</button>` : ""}</div></div>`; }).join("")}</div></section>`).join("")}`, "studio");
}
/** trim silence, normalise and encode as 16-bit mono WAV */
async function cleanClip(blob) {
  const ac = new (window.AudioContext || window.webkitAudioContext)(); const buf = await ac.decodeAudioData(await blob.arrayBuffer()); const d = buf.getChannelData(0); const sr = buf.sampleRate;
  let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v)); const th = Math.max(0.02, peak * 0.08);
  let a = 0, b = d.length - 1; while (a < b && Math.abs(d[a]) < th) a++; while (b > a && Math.abs(d[b]) < th) b--;
  a = Math.max(0, a - Math.round(sr * 0.08)); b = Math.min(d.length - 1, b + Math.round(sr * 0.25));
  const g = peak > 0 ? 0.9 / peak : 1; const out = d.subarray(a, b + 1); const n = out.length;
  const wav = new DataView(new ArrayBuffer(44 + n * 2)); const w = (o, str) => [...str].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); wav.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, sr, true); wav.setUint32(28, sr * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, "data"); wav.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i] * g)) * 32767, true);
  ac.close(); return new Blob([wav], { type: "audio/wav" });
}
function viewAdmin() {
  const pend = isOwner() ? accounts.filter((a) => a.status === "pending").length : 0;
  const tile = (href, icon, title, sub, badge) => `<a class="admin-tile" href="${href}"><span class="at-ic">${icon}</span><b>${title}${badge ? ` <b class="dot-n">${badge}</b>` : ""}</b><small>${sub}</small></a>`;
  $app().innerHTML = shell(`
    ${pageHead("الإدارة", "كل اللي تحتاجه خارج وقت اللقاء.")}
    <div class="admin-grid">
      ${tile("#reports", "📝", "التقارير", "الأسبوعي جاهز للنسخ، الحضور، بيانات اللقاءات")}
      ${tile("#kids", "🎒", "المغامرون", "الأسماء والمراكز والجوازات")}
      ${tile("#guide", "🧭", "دليل طريق القوافل", "القواعد والبطاقات والمحطات والمستويات")}
      ${tile("#seals", "📜", "الرسائل المختومة", "نصوص الأختام ولقاء البداية")}
      ${tile("#print/set", "🖨️", "الطباعة", "مجموعة البطاقات الثابتة")}
      ${tile("#screen", "📺", "شاشة التلفاز", "القوافل والمستويات والختم والدوري")}
      ${tile("season1.html", "🎬", "فيلم الموسم الأول", "إعلان القوافل · يُعرض على التلفاز بملء الشاشة")}
      ${isOwner() ? tile("#accounts", "👥", "الحسابات", "الموافقات والصلاحيات", pend) : ""}
      ${tile("#profile", "🙂", "حسابي", "الاسم وتسجيل الخروج")}
    </div>`, "admin");
}

// ---------------- reports ----------------
function viewReports() {
  const act = L.activeKids(S); const edit = can("plan");
  const rstart = Number((S.app_settings || []).find((x) => x.key === "report_start")?.value ?? 1);
  const rows = S.meetings.filter((m) => (m.number || 0) >= rstart).map((m) => {
    const rec = act.filter((k) => L.recorded(I, m.id, k.id));
    const pres = rec.filter((k) => L.present(I, m.id, k.id));
    const avg = pres.length ? pres.reduce((n, k) => n + L.net(I, m.id, k.id), 0) / pres.length : 0;
    const stars = S.caravans.reduce((n, c) => n + L.teamMeet(S, I, m.id, c.id).stars, 0);
    const ded = S.deductions.filter((d) => d.meeting_id === m.id && d.value > 0).length;
    return { m, rec: rec.length, pres: pres.length, avg, stars, ded };
  });
  const done = rows.filter((r) => r.rec);
  const attRate = done.length ? Math.round((done.reduce((n, r) => n + r.pres, 0) / done.reduce((n, r) => n + r.rec, 0)) * 100) : null;
  const last = done[done.length - 1];
  const m = I.meet[meetId]; const cur = rows.find((r) => r.m.id === meetId);
  const maxPres = Math.max(1, ...rows.map((r) => r.rec));
  const weekly = m ? weeklyReport(m, cur) : "";
  $app().innerHTML = shell(`
    <section class="bar"><h1 class="h1">التقارير</h1>${meetPicker()}</section>
    <p class="muted small">التقارير تُحسب من اللقاء ${edit ? `<select data-act="reportstart" aria-label="بداية التقارير">${S.meetings.map((x) => `<option value="${x.number}" ${x.number === rstart ? "selected" : ""}>${x.number}</option>`).join("")}</select>` : rstart} وما بعده.</p>
    <div class="stats">
      <div class="stat"><span>متوسط الحضور</span><b class="num">${attRate == null ? "—" : attRate + "%"}</b><small class="${attRate == null ? "" : attRate >= 85 ? "good" : "bad"}">المستهدف 85%+</small></div>
      <div class="stat"><span>المغامرون النشطون</span><b class="num">${act.length}</b><small>من ${S.kids.length} مسجّل</small></div>
      <div class="stat"><span>آخر لقاء مسجّل</span><b class="num">${last ? last.pres + "/" + last.rec : "—"}</b><small>${last ? "اللقاء " + last.m.number : ""}</small></div>
      <div class="stat"><span>نجوم القوافل</span><b class="num">${rows.reduce((n, r) => n + r.stars, 0)}</b><small>منذ بداية الدورة</small></div>
    </div>
    <section class="panel"><h3>الحضور لكل لقاء</h3><div class="att-chart" role="img" aria-label="رسم الحضور لكل لقاء">${rows.map((r) => `<div class="col"><div class="barbox"><i style="height:${(r.pres / maxPres) * 100}%"></i></div><b class="num">${r.rec ? r.pres : "—"}</b><span>${r.m.number}</span></div>`).join("")}</div></section>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>اللقاء</th><th>التاريخ</th><th>الحضور</th><th>متوسط النقاط</th><th>النجوم</th><th>الخصومات</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.m.number}</td><td>${fmtDate(r.m.meet_date)}</td><td class="num">${r.rec ? r.pres + "/" + r.rec : "—"}</td><td class="num">${r.rec ? r.avg.toFixed(1) : "—"}</td><td class="num">${r.stars}</td><td class="num">${r.ded}</td></tr>`).join("")}</tbody></table></div>
    ${m ? `<section class="panel"><h3>بيانات اللقاء ${m.number}</h3>
      ${edit ? `<div class="grid2"><label>موضوع الأسبوع<input id="mt-theme" value="${esc(m.theme || "")}" maxlength="80"></label><label>المهارة<input id="mt-skill" value="${esc(m.skill || "")}" maxlength="80"></label><label>ديوان المعرفة<input id="mt-diwan" value="${esc(m.diwan || "")}" maxlength="120"></label><label>تاريخ اللقاء<input id="mt-date" type="date" value="${m.meet_date}"></label></div><label>بطاقة الملاحظة بعد اللقاء<textarea id="mt-obs" rows="3" maxlength="1200" placeholder="ما نجح، ما يحتاج تحسين، أطفال يحتاجون متابعة">${esc(m.observation || "")}</textarea></label><div class="row-btns"><button class="btn" data-act="meetsave" data-id="${m.id}">حفظ بيانات اللقاء</button><button class="btn danger" data-act="meetdel" data-id="${m.id}">حذف هذا اللقاء</button></div>
      <div class="addrow"><input id="mt-new" type="date" aria-label="تاريخ لقاء جديد"><button class="btn ghost" data-act="meetadd">إضافة لقاء</button></div>`
        : `<p>${m.theme ? "الموضوع: " + esc(m.theme) : ""} ${m.skill ? "· المهارة: " + esc(m.skill) : ""}</p>${m.observation ? `<p class="muted">${esc(m.observation)}</p>` : ""}`}</section>
    <section class="panel"><h3>التقرير الأسبوعي جاهز للنسخ</h3><pre id="weekly" class="weekly">${esc(weekly)}</pre><button class="btn ghost" data-act="copyweekly">نسخ التقرير</button></section>` : ""}`, "reports");
}
function weeklyReport(m, r) {
  const st = S.caravans.map((c) => { const t = L.teamMeet(S, I, m.id, c.id); return `- ${c.name}: ${t.stars === 2 ? "نجمة ذهبية" : t.stars === 1 ? "نجمة" : "بدون نجمة"} (جاهزون ${t.ready}/${t.n})`; }).join("\n");
  const top = L.ranked(S, I, L.activeKids(S), m.id).filter((x) => x.today >= L.NC).map((x) => x.k.first_name).slice(0, 8).join("، ");
  const ms = S.matches.filter((x) => x.meeting_id === m.id && x.played).map((x) => `- ${carName(x.home_id)} ${x.home_goals} × ${x.away_goals} ${carName(x.away_id)}`).join("\n");
  const blue = S.cards.filter((c) => c.color === "blue" && S.matches.some((x) => x.id === c.match_id && x.meeting_id === m.id)).map((c) => I.kid[c.kid_id] ? I.kid[c.kid_id].first_name : "").filter(Boolean).join("، ");
  return `التقرير الأسبوعي · فئة المغامرين · حي الهجرة
اللقاء ${m.number} · الخميس ${fmtDate(m.meet_date)}
${m.theme ? "الموضوع: " + m.theme + "\n" : ""}${m.skill ? "المهارة: " + m.skill + "\n" : ""}
الحضور: ${r && r.rec ? r.pres + " من " + r.rec : "لم يُسجّل"}
متوسط نقاط الحاضرين: ${r && r.rec ? r.avg.toFixed(1) + " من " + L.NC : "—"}
الخصومات: ${r ? r.ded : 0}

نجوم القوافل:
${st}
${top ? "\nحصلوا على النقاط الخمس كاملة: " + top : ""}${ms ? "\n\nنتائج الدوري:\n" + ms : ""}${blue ? "\nبطاقات الأمانة الزرقاء: " + blue : ""}
${m.observation ? "\nملاحظات المشرف:\n" + m.observation : ""}`.trim();
}

// ---------------- accounts (owner) ----------------
function viewAccounts() {
  const pend = accounts.filter((a) => a.status === "pending"), ok = accounts.filter((a) => a.status === "approved" && a.id !== me.id), rej = accounts.filter((a) => a.status === "rejected");
  const roleSel = (a) => `<select id="ar-${a.id}" aria-label="الدور"><option value="program_manager" ${a.requested_role === "program_manager" ? "selected" : ""}>مدير البرنامج</option><option value="club_manager" ${a.requested_role === "club_manager" ? "selected" : ""}>مدير النادي</option><option value="assistant" ${a.requested_role === "assistant" || a.requested_role === "other" ? "selected" : ""}>المساعد</option></select>`;
  $app().innerHTML = shell(`
    <section class="bar"><h1 class="h1">الحسابات</h1></section>
    <section class="panel"><h3>بانتظار موافقتك <span class="num">(${pend.length})</span></h3>
      ${pend.length ? pend.map((a) => `<div class="acc"><div><b>${esc(a.full_name || "بدون اسم")}</b><span class="muted">${esc(a.email)}</span><small>طلب: ${ROLE_AR[a.requested_role] || "—"} · ${a.created_at.slice(0, 10)}</small></div><div class="acc-act">${roleSel(a)}<button class="btn sm" data-act="approve" data-id="${a.id}">موافقة</button><button class="btn danger sm" data-act="reject" data-id="${a.id}">رفض</button></div></div>`).join("") : '<p class="muted">لا توجد طلبات جديدة.</p>'}
      <p class="muted small">أي شخص يسجّل بإيميله يظهر هنا، ولا يدخل الموقع إلا بعد موافقتك. مديرو البرنامج والنادي يشاهدون فقط، والمساعد يعدّل ما تسمح له به.</p></section>
    <section class="panel"><h3>الحسابات المعتمدة</h3>
      ${ok.length ? ok.map((a) => `<div class="acc"><div><b>${esc(a.full_name || "بدون اسم")}</b><span class="muted">${esc(a.email)}</span><small>${ROLE_AR[a.role]}</small></div>
        ${a.role === "assistant" ? `<div class="perms">${PERMS.map(([p, t]) => `<label class="chk"><input type="checkbox" data-act="perm" data-id="${a.id}" data-p="${p}" ${a.perms && a.perms[p] ? "checked" : ""}> ${t}</label>`).join("")}</div>` : ""}
        <div class="acc-act">${roleSel({ ...a, requested_role: a.role })}<button class="btn ghost sm" data-act="approve" data-id="${a.id}">تغيير الدور</button><button class="btn danger sm" data-act="reject" data-id="${a.id}">إيقاف الحساب</button></div></div>`).join("") : '<p class="muted">لا توجد حسابات معتمدة غيرك.</p>'}</section>
    ${rej.length ? `<section class="panel"><h3>المرفوضة والموقوفة</h3>${rej.map((a) => `<div class="acc"><div><b>${esc(a.full_name || "بدون اسم")}</b><span class="muted">${esc(a.email)}</span></div><div class="acc-act">${roleSel(a)}<button class="btn ghost sm" data-act="approve" data-id="${a.id}">موافقة</button></div></div>`).join("")}</section>` : ""}`, "accounts");
}

function viewProfile() {
  $app().innerHTML = shell(`<section class="panel narrow"><h1 class="h1">حسابي</h1><p class="muted">${esc(me.email)} · ${ROLE_AR[me.role]}</p>
    <label>الاسم<input id="pf-name" value="${esc(me.full_name)}" maxlength="60"></label><button class="btn" data-act="savename">حفظ الاسم</button>
    <hr><a class="btn ghost" href="#reset">تغيير كلمة المرور</a> <button class="btn ghost" data-act="logout">تسجيل الخروج</button></section>`, "");
}

// ---------------- actions ----------------
const sel = (id) => document.getElementById(id);
/** write a duty row, and remove it when it no longer carries anything */
async function saveDuty(mid, car, patch) {
  const cur = L.dutyRow(S, mid, car) || { mastered: false, speaker_kid: null, topic: null };
  const next = { ...cur, ...patch };
  if (!next.mastered && !next.speaker_kid && next.topic == null) return db.remove("duty_log", { meeting_id: mid, caravan_id: car });
  return db.upsert("duty_log", [{ meeting_id: mid, caravan_id: car, mastered: !!next.mastered, speaker_kid: next.speaker_kid || null, topic: next.topic ?? null }], "meeting_id,caravan_id");
}
async function setPoint(kid, patch) {
  const key = meetId + "|" + kid; const prev = I.pts[key] ? { ...I.pts[key] } : null;
  const row = { meeting_id: meetId, kid_id: kid, ...(prev ? {} : {}), ...patch };
  // optimistic
  const local = { ...(prev || { meeting_id: meetId, kid_id: kid, present: true, i: 0, t: 0, m: 0, s: 0, a: 0, fazaa: false, home: false }), ...patch };
  const ix = S.points.findIndex((p) => p.meeting_id === meetId && p.kid_id === kid);
  if (ix >= 0) S.points[ix] = local; else S.points.push(local);
  I = L.index(S); render();
  const ok = await guard(() => (L.meaningful(local) ? db.upsert("points", [row], "meeting_id,kid_id") : db.remove("points", { meeting_id: meetId, kid_id: kid })));
  if (ok !== undefined && !L.meaningful(local)) { S.points = S.points.filter((p) => !(p.meeting_id === meetId && p.kid_id === kid)); I = L.index(S); render(); }
  if (ok === undefined) { if (prev) S.points[S.points.findIndex((p) => p.meeting_id === meetId && p.kid_id === kid)] = prev; else S.points = S.points.filter((p) => !(p.meeting_id === meetId && p.kid_id === kid)); I = L.index(S); render(); }
}
const busy = new Set();
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT" || (b.tagName === "INPUT" && b.type !== "checkbox")) return;
  const a = b.dataset.act; const key = JSON.stringify(b.dataset);
  if (b.tagName === "INPUT") return; // checkboxes handled on change
  if (busy.has(key)) return; busy.add(key); setTimeout(() => busy.delete(key), a === "tc" || a === "pt" ? 150 : 400);
  const k = b.dataset.k, id = b.dataset.id;
  switch (a) {
    case "logout": await auth.signOut(); me = null; S = null; location.hash = "login"; return render();
    case "recheck": me = null; await guard(loadMe); return render();
    case "livecar": ui.liveCar = b.dataset.v; return viewLive();
    case "draw": { const car = Number(b.dataset.car), slot = Number(b.dataset.slot); const kind = L.drawKind(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
      const r = await guard(() => db.insert("power_cards", [{ caravan_id: car, meeting_id: meetId, slot, kind }]));
      if (r !== undefined) { ui.reveal = { car, kind }; const nid = first(r).id; toast("انسحبت البطاقة", "ok", async () => { await db.remove("power_cards", { id: nid }); ui.reveal = null; await reload("power_cards"); }); }
      await guard(() => reload("power_cards")); return render(); }
    case "revealclose": ui.reveal = null; return render();
    case "draw2": ui.drawn = { kind: drawCardKind() }; return render();
    case "drawcancel": ui.drawn = null; return render();
    case "drawgive": { const car = Number(b.dataset.car); const kind = ui.drawn && ui.drawn.kind; if (!kind) return;
      const r = await guard(() => db.insert("power_cards", [{ caravan_id: car, meeting_id: meetId, slot: 0, kind }])); ui.drawn = null;
      if (r !== undefined) { const nid = first(r).id; toast(`${L.POWER[kind].name} ← ${carName(car)}`, "ok", async () => { await db.remove("power_cards", { id: nid }); await reload("power_cards"); }); }
      await guard(() => reload("power_cards")); return render(); }
    case "cardused": { const p = S.power_cards.find((x) => String(x.id) === String(id)); if (!p) return; const prev = p.used_at || null; const v = prev ? null : new Date().toISOString();
      return doUndoable(v ? "سُجّلت مستخدمة" : "رجعت البطاقة", () => db.update("power_cards", { id: p.id }, { used_at: v }), () => db.update("power_cards", { id: p.id }, { used_at: prev }), ["power_cards"]); }
    case "ptstart": ui.ptimer = { label: b.dataset.l, end: Date.now() + Number(b.dataset.m) * 60000 }; return;
    case "ptstop": ui.ptimer = null; { const el = document.getElementById("plan-now"); if (el) el.querySelector(".pt-timer")?.remove(); } return;
    case "copy": try { await navigator.clipboard.writeText(b.dataset.v); toast("تم النسخ ✓"); } catch (e2) { toast("ما قدرت أنسخ، انسخه يدويًا", "err"); } return;
    case "drawrun": ui.drawPlan = computeDraw(); return render();
    case "drawcancel2": ui.drawPlan = null; return render();
    case "drawapply": { const plan = ui.drawPlan; if (!plan) return; const prev = L.activeKids(S).map((k) => ({ id: k.id, caravan_id: k.caravan_id })); const chg = prev.filter((x) => plan[x.id] !== x.caravan_id);
      ui.drawPlan = null; ui.drawOpen = true;
      return doUndoable(`اعتُمدت القرعة (${chg.length} تغيير)`, async () => { for (const x of chg) await db.update("kids", { id: x.id }, { caravan_id: plan[x.id] }); return chg; }, async (c) => { for (const x of c) await db.update("kids", { id: x.id }, { caravan_id: x.caravan_id }); }, ["kids"]); }
    case "anngo": ui.screenTab = "announce"; ui.ann = 0; return;
    case "annnext": ui.ann = Math.min(annSteps().length - 1, (ui.ann || 0) + 1); return viewScreen();
    case "annprev": ui.ann = Math.max(0, (ui.ann || 0) - 1); return viewScreen();
    case "rec": {
      if (ui.rec && ui.rec.id === id) { ui.rec.recorder.stop(); return; }
      if (ui.rec) return;
      try { ui.micStream = ui.micStream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); } catch (x) { return toast("ما قدرنا نوصل للمايك. اسمح للمتصفح باستخدامه.", "err"); }
      const recorder = new MediaRecorder(ui.micStream); const chunks = []; ui.rec = { id, recorder };
      recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      recorder.onstop = async () => { const rid = ui.rec.id; ui.rec = null; viewStudio();
        await guard(async () => { const clean = await cleanClip(new Blob(chunks, { type: recorder.mimeType })); await storage.upload("film-voice", rid + ".wav", clean); ui.voiceHave.add(rid); }, "✓ انحفظ التسجيل"); viewStudio(); };
      recorder.start(); return viewStudio(); }
    case "recplay": { const a = new Audio(storage.publicUrl("film-voice", id + ".wav") + "?v=" + Date.now()); a.play().catch(() => toast("ما اشتغل الصوت", "err")); return; }
    case "recdel": if (ui.armed !== key) { ui.armed = key; b.textContent = "حذف؟"; setTimeout(() => (ui.armed = null), 3000); return; }
      await guard(async () => { await storage.remove("film-voice", id + ".wav"); ui.voiceHave.delete(id); }, "حُذف التسجيل"); return viewStudio();
    case "stepdone": { const kk = `mgh.step.${b.dataset.mid}.${k}`; try { localStorage.getItem(kk) === "1" ? localStorage.removeItem(kk) : localStorage.setItem(kk, "1"); } catch (x) {} return render(); }
    case "present_mode": ui.present = !ui.present; try { localStorage.setItem("mgh.present", ui.present ? "1" : "0"); } catch (x) {} toast(ui.present ? "وضع العرض: ملاحظاتك الخاصة مخفية" : "ملاحظاتك الخاصة ظاهرة"); return render();
    case "carddrawdel": if (ui.armed !== key) { ui.armed = key; b.textContent = "حذف؟"; setTimeout(() => (ui.armed = null), 3000); return; }
      await guard(() => db.remove("power_cards", { id }), "حُذفت البطاقة، وتقدر تسحب من جديد"); await guard(() => reload("power_cards")); return render();
    case "kiddel": if (ui.armed !== key) { ui.armed = key; b.textContent = "متأكد؟ يحذف كل سجله"; setTimeout(() => (ui.armed = null), 4000); return; }
      ui.editKid = null; await guard(() => db.remove("kids", { id }), "حُذف المغامر"); await guard(() => reload("kids", "points", "deductions", "badges", "goals", "cards", "kid_notes", "measures", "duty_log")); return render();
    case "matchdel": if (ui.armed !== key) { ui.armed = key; b.textContent = "متأكد؟"; setTimeout(() => (ui.armed = null), 3000); return; }
      ui.openMatch = null; await guard(() => db.remove("matches", { id }), "حُذفت المباراة"); await guard(() => reload("matches", "goals", "cards", "power_cards")); return render();
    case "duty": { const car = Number(b.dataset.car); const mid = Number(b.dataset.mid) || meetId; const v = !L.dutyMastered(S, mid, car);
      const before = L.dutyRow(S, mid, car);
      return doUndoable(v ? "✅ سُجّل الإتقان" : "أُلغي الإتقان", () => saveDuty(mid, car, { mastered: v }), () => (before ? db.upsert("duty_log", [{ meeting_id: mid, caravan_id: car, mastered: before.mastered, speaker_kid: before.speaker_kid, topic: before.topic }], "meeting_id,caravan_id") : db.remove("duty_log", { meeting_id: mid, caravan_id: car })), ["duty_log"]); }
    case "doprint": return window.print();
    case "sealsave": { const n = Number(b.dataset.n); const o = S.seals.find((x) => x.n === n) || {}; const prev = { n, title: o.title || "", hint: o.hint || "", body: o.body || "", mission: o.mission || "" };
      return doUndoable("حُفظ الختم", () => db.upsert("seals", [{ n, title: sel("sl-t-" + n).value.trim(), hint: sel("sl-h-" + n).value.trim(), body: sel("sl-b-" + n).value.trim(), mission: sel("sl-m-" + n).value.trim() }], "n"), () => db.upsert("seals", [prev], "n"), ["seals"]); }
    case "sealopen": ui.openSeal = ui.openSeal === Number(b.dataset.n) ? null : Number(b.dataset.n); return viewSeals();
    case "scrtab": ui.screenTab = b.dataset.v; return viewScreen();
    case "ltab": ui.leagueTab = b.dataset.v; return viewLeague();
    case "present": return setPoint(k, { present: !L.present(I, meetId, k) });
    case "pt": { const r = L.row(I, meetId, k) || {}; return setPoint(k, { [b.dataset.c]: r[b.dataset.c] ? 0 : 1 }); }
    case "fazaa": { const r = L.row(I, meetId, k) || {}; const car = I.kid[k].caravan_id; if (!r.fazaa && L.kidsOf(S, car).some((x) => x.id !== k && (L.row(I, meetId, x.id) || {}).fazaa)) return toast("الفزعة مرة وحدة لكل قافلة في اللقاء.", "err"); return setPoint(k, { fazaa: !r.fazaa }); }
    case "warn": return doUndoable("سُجّل الإنذار", () => db.insert("deductions", [{ meeting_id: meetId, kid_id: k, value: 0, reason: "إنذار شفهي" }]), (r) => db.remove("deductions", { id: first(r).id }), ["deductions"]);
    case "dedopen": ui.openDed = ui.openDed === k ? null : k; return render();
    case "dedadd": { const r = L.REASONS[Number(sel("dr-" + k).value)]; ui.openDed = null; return doUndoable("سُجّل الخصم", () => db.insert("deductions", [{ meeting_id: meetId, kid_id: k, value: r[1], reason: r[0] }]), (x) => db.remove("deductions", { id: first(x).id }), ["deductions"]); }
    case "dedundo": await guard(() => db.remove("deductions", { id }), "تم التراجع"); await guard(() => reload("deductions")); return render();
    case "tc": { const car = Number(b.dataset.car); const v = Math.max(0, (I.tc[meetId + "|" + car] || 0) + Number(b.dataset.d));
      const ix = S.team_challenge.findIndex((x) => x.meeting_id === meetId && x.caravan_id === car); const prev = ix >= 0 ? S.team_challenge[ix].points : null;
      if (ix >= 0) S.team_challenge[ix] = { ...S.team_challenge[ix], points: v }; else S.team_challenge.push({ meeting_id: meetId, caravan_id: car, points: v });
      I = L.index(S); render();
      const r = await guard(() => (v ? db.upsert("team_challenge", [{ meeting_id: meetId, caravan_id: car, points: v }], "meeting_id,caravan_id") : db.remove("team_challenge", { meeting_id: meetId, caravan_id: car })));
      if (r !== undefined && !v) { S.team_challenge = S.team_challenge.filter((x) => !(x.meeting_id === meetId && x.caravan_id === car)); I = L.index(S); render(); }
      if (r === undefined) { await guard(() => reload("team_challenge")); render(); } return; }
    case "carsave": { const cid = Number(id); const old = I.car[cid]; const prev = { name: old.name, color: old.color, chant: old.chant, charter: old.charter }; const patch = { name: sel("cn-" + cid).value.trim() || old.name, color: sel("cc-" + cid).value, chant: sel("ch-" + cid).value.trim(), charter: sel("ct-" + cid).value.trim() };
      return doUndoable("حُفظت القافلة", () => db.update("caravans", { id: cid }, patch), () => db.update("caravans", { id: cid }, prev), ["caravans"]); }
    case "balance": ui.balancePlan = L.suggestBalance(S); return viewCaravans();
    case "balcancel": ui.balancePlan = null; return viewCaravans();
    case "balapply": { const plan = ui.balancePlan; ui.balancePlan = null; const ch = L.activeKids(S).filter((x) => plan[x.id] !== x.caravan_id).map((x) => ({ id: x.id, from: x.caravan_id, to: plan[x.id] }));
      return doUndoable("اعتُمد التوزيع (" + ch.length + " تغيير)", async () => { for (const x of ch) await db.update("kids", { id: x.id }, { caravan_id: x.to }); return true; }, async () => { for (const x of ch) await db.update("kids", { id: x.id }, { caravan_id: x.from }); }, ["kids"]); }
    case "kidadd": { const f = sel("nk-first").value.trim(), fam = sel("nk-fam").value.trim(), car = sel("nk-car").value; if (!f) return toast("اكتب الاسم الأول.", "err"); return doUndoable("أُضيف " + f, () => db.insert("kids", [{ first_name: f, family_name: fam, caravan_id: car ? Number(car) : null }]), (r) => db.remove("kids", { id: first(r).id }), ["kids"]); }
    case "kidedit": ui.editKid = id || null; return viewKids();
    case "kidsave": { const f = sel("ek-first").value.trim(); if (!f) return toast("الاسم الأول مطلوب.", "err"); const o = I.kid[id]; const prev = { first_name: o.first_name, family_name: o.family_name, official: o.official }; const patch = { first_name: f, family_name: sel("ek-fam").value.trim(), official: sel("ek-off").checked }; ui.editKid = null;
      return doUndoable("حُفظ الاسم", () => db.update("kids", { id }, patch), () => db.update("kids", { id }, prev), ["kids"]); }
    case "kidactive": { const kd = I.kid[id]; const was = kd.active; return doUndoable(was ? "أُوقف" : "فُعّل", () => db.update("kids", { id }, { active: !was }), () => db.update("kids", { id }, { active: was }), ["kids"]); }
    case "badgeadd": { const ev = sel("bd-ev").value.trim(); if (!ev) return toast("اكتب الشاهد: الموقف أو الإنجاز اللي استحق عليه الشارة.", "err"); return doUndoable("مُنحت الشارة", () => db.insert("badges", [{ kid_id: k, badge: sel("bd-type").value, evidence: ev, meeting_id: meetId }]), (r) => db.remove("badges", { id: first(r).id }), ["badges"]); }
    case "badgedel": if (ui.armed !== key) { ui.armed = key; b.textContent = "تأكيد؟"; setTimeout(() => (ui.armed = null), 3000); return; } await guard(() => db.remove("badges", { id }), "حُذفت"); await guard(() => reload("badges")); return render();
    case "noteadd": { const t = sel("nt-body").value.trim(); if (!t) return; return doUndoable("أُضيفت الكلمة", () => db.insert("kid_notes", [{ kid_id: k, body: t }]), (r) => db.remove("kid_notes", { id: first(r).id }), ["kid_notes"]); }
    case "notedel": if (ui.armed !== key) { ui.armed = key; b.textContent = "تأكيد؟"; setTimeout(() => (ui.armed = null), 3000); return; } await guard(() => db.remove("kid_notes", { id }), "حُذفت"); await guard(() => reload("kid_notes")); return render();
    case "print": return window.print();
    case "mopen": ui.openMatch = ui.openMatch === Number(id) ? null : Number(id); return viewLeague();
    case "msave": { const mid = Number(id); const hg = sel("mh-" + mid).value, ag = sel("ma-" + mid).value;
      const th = Number(sel("mth-" + mid).value), ta = Number(sel("mta-" + mid).value); if (th === ta) return toast("اختر قافلتين مختلفتين.", "err");
      const played = hg !== "" && ag !== "";
      const patch = { home_id: th, away_id: ta, round: Number(sel("mr-" + mid).value) || 1, meeting_id: Number(sel("mm-" + mid).value), home_goals: played ? Number(hg) : null, away_goals: played ? Number(ag) : null, played, fair_home: sel("mfh-" + mid).checked, fair_away: sel("mfa-" + mid).checked, home_keeper: sel("mkh-" + mid).value || null, away_keeper: sel("mka-" + mid).value || null, spirit_kid: sel("msp-" + mid).value || null };
      const chosen = [sel("mph-" + mid), sel("mpa-" + mid)].map((x) => (x && x.value ? Number(x.value) : null)).filter(Boolean);
      const om = S.matches.find((x) => x.id === mid); const prevM = Object.fromEntries(Object.keys(patch).map((kk) => [kk, om[kk]])); const prevCards = S.power_cards.filter((p) => p.used_match_id === mid || chosen.includes(p.id)).map((p) => ({ id: p.id, used_match_id: p.used_match_id }));
      return doUndoable("حُفظت النتيجة", async () => {
        await db.update("matches", { id: mid }, patch);
        for (const p of S.power_cards.filter((p) => p.used_match_id === mid && !chosen.includes(p.id))) await db.update("power_cards", { id: p.id }, { used_match_id: null });
        for (const pid of chosen) if (!S.power_cards.some((p) => p.id === pid && p.used_match_id === mid)) await db.update("power_cards", { id: pid }, { used_match_id: mid });
        return true;
      }, async () => { await db.update("matches", { id: mid }, prevM); for (const p of prevCards) await db.update("power_cards", { id: p.id }, { used_match_id: p.used_match_id }); }, ["matches", "power_cards"]); }
    case "goaladd": { const mid = Number(id); const kid = sel("mg-" + mid).value; if (!kid) return toast("اختر اللاعب اللي سجّل.", "err"); return doUndoable("سُجّل الهدف", () => db.insert("goals", [{ match_id: mid, kid_id: kid }]), (r) => db.remove("goals", { id: first(r).id }), ["goals"]); }
    case "goaldel": await guard(() => db.remove("goals", { id }), "حُذف الهدف"); await guard(() => reload("goals")); return render();
    case "cardadd": { const mid = Number(id); const kid = sel("mck-" + mid).value; if (!kid) return toast("اختر اللاعب.", "err"); return doUndoable("سُجّلت البطاقة", () => db.insert("cards", [{ match_id: mid, kid_id: kid, color: sel("mcc-" + mid).value, reason: sel("mcr-" + mid).value.trim() }]), (r) => db.remove("cards", { id: first(r).id }), ["cards"]); }
    case "carddel": await guard(() => db.remove("cards", { id }), "حُذفت البطاقة"); await guard(() => reload("cards")); return render();
    case "addfinal": { if (S.matches.some((m) => m.stage === "final")) return toast("النهائي مضاف من قبل.", "err"); const st = L.standings(S); if (st.length < 4) return; const last = S.meetings[S.meetings.length - 1];
      return doUndoable("أُضيف النهائي", () => db.insert("matches", [{ round: 7, stage: "final", meeting_id: last && last.id, home_id: st[0].id, away_id: st[1].id }, { round: 7, stage: "third", meeting_id: last && last.id, home_id: st[2].id, away_id: st[3].id }]), async (r) => { for (const x of r) await db.remove("matches", { id: x.id }); }, ["matches"]); }
    case "meetsave": { const mid = Number(id); const o = I.meet[mid]; const prev = { theme: o.theme, skill: o.skill, diwan: o.diwan, observation: o.observation, meet_date: o.meet_date };
      return doUndoable("حُفظت بيانات اللقاء", () => db.update("meetings", { id: mid }, { theme: sel("mt-theme").value.trim(), skill: sel("mt-skill").value.trim(), diwan: sel("mt-diwan").value.trim(), observation: sel("mt-obs").value.trim(), meet_date: sel("mt-date").value }), () => db.update("meetings", { id: mid }, prev), ["meetings"]); }
    case "meetadd": { const d = sel("mt-new").value; if (!d) return toast("اختر تاريخ اللقاء.", "err"); if (S.meetings.some((x) => x.meet_date === d)) return toast("فيه لقاء بنفس التاريخ.", "err");
      return doUndoable("أُضيف اللقاء", async () => { const r = await db.insert("meetings", [{ meet_date: d }]); await renumber(); return r; }, async (r) => { await db.remove("meetings", { id: first(r).id }); meetId = null; await renumber(); }); }
    case "meetdel": if (ui.armed !== key) { ui.armed = key; b.textContent = "متأكد؟ يحذف نقاطه وحضوره"; setTimeout(() => (ui.armed = null), 4000); return; }
      await guard(async () => { await db.remove("meetings", { id }); meetId = null; await renumber(); }, "حُذف اللقاء"); return render();
    case "copyweekly": { const t = sel("weekly").textContent; try { await navigator.clipboard.writeText(t); toast("نُسخ التقرير"); } catch (x) { const r = document.createRange(); r.selectNodeContents(sel("weekly")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("النص محدد، انسخه"); } return; }
    case "approve": { const role = sel("ar-" + id).value; const perms = role === "assistant" ? { points: true, league: true } : {}; await guard(() => db.rpc("decide_account", { target: id, decision: "approve", new_role: role, new_perms: perms }), "تمت الموافقة"); await guard(loadAccounts); return render(); }
    case "reject": if (ui.armed !== key) { ui.armed = key; b.textContent = "متأكد؟"; setTimeout(() => (ui.armed = null), 3000); return; } await guard(() => db.rpc("decide_account", { target: id, decision: "reject" }), "تم"); await guard(loadAccounts); return render();
    case "savename": { const n = sel("pf-name").value.trim(); await guard(() => db.rpc("set_my_name", { n }), "حُفظ الاسم"); me.full_name = n; return render(); }
  }
});
document.addEventListener("change", async (e) => {
  const t = e.target; const a = t.dataset && t.dataset.act; if (!a) return;
  if (a === "dutyspk" || a === "dutytopic") { const mid = Number(t.dataset.mid), car = Number(t.dataset.car);
    const row = a === "dutyspk" ? { speaker_kid: t.value || null } : { topic: t.value === "" ? null : Number(t.value) };
    const before = L.dutyRow(S, mid, car);
    return doUndoable(a === "dutyspk" ? "حُفظ المتحدث" : "حُفظ الموضوع", () => saveDuty(mid, car, row), () => (before ? db.upsert("duty_log", [{ meeting_id: mid, caravan_id: car, mastered: before.mastered, speaker_kid: before.speaker_kid, topic: before.topic }], "meeting_id,caravan_id") : db.remove("duty_log", { meeting_id: mid, caravan_id: car })), ["duty_log"]); }
  if (a === "carlead") { const car = Number(t.dataset.car), f = t.dataset.f; const prev = I.car[car][f] || null; const v = t.value || null;
    const others = { leader_kid: "القائد", deputy_kid: "النائب" }; if (v && f !== "captain_kid" && ["leader_kid", "deputy_kid"].some((g) => g !== f && I.car[car][g] === v)) { toast("نفس الطفل ما يكون قائد ونائب.", "err"); return render(); }
    return doUndoable("حُفظت القيادة", () => db.update("caravans", { id: car }, { [f]: v }), () => db.update("caravans", { id: car }, { [f]: prev }), ["caravans"]); }
  if (a === "reportstart") { await guard(() => db.upsert("app_settings", [{ key: "report_start", value: Number(t.value) }], "key"), "حُفظت بداية التقارير"); await guard(() => reload("app_settings")); return render(); }
  if (a === "sealstart") { await guard(() => db.upsert("app_settings", [{ key: "seal_start", value: Number(t.value) }], "key"), "حُفظ لقاء البداية"); await guard(() => reload("app_settings")); return render(); }
  if (a === "meet") { meetId = Number(t.value); ui.openDed = null; return render(); }
  if (a === "kidpin") { const k = I.kid[t.dataset.k]; ui.drawOpen = true; return doUndoable(t.checked ? "ثُبّت" : "أُلغي التثبيت", () => db.update("kids", { id: k.id }, { pinned: t.checked }), () => db.update("kids", { id: k.id }, { pinned: k.pinned }), ["kids"]); }
  if (a === "kidpincar") { const k = I.kid[t.dataset.k]; const prev = { caravan_id: k.caravan_id, pinned: k.pinned }; const v = t.value ? Number(t.value) : null; ui.drawOpen = true;
    const roles = S.caravans.filter((c) => c.leader_kid === k.id || c.deputy_kid === k.id).map((c) => ({ id: c.id, leader_kid: c.leader_kid, deputy_kid: c.deputy_kid }));
    return doUndoable("حُفظت القافلة", async () => { await db.update("kids", { id: k.id }, { caravan_id: v, pinned: true }); for (const c of roles) await db.update("caravans", { id: c.id }, { leader_kid: c.leader_kid === k.id ? null : c.leader_kid, deputy_kid: c.deputy_kid === k.id ? null : c.deputy_kid }); return true; },
      async () => { await db.update("kids", { id: k.id }, prev); for (const c of roles) await db.update("caravans", { id: c.id }, { leader_kid: c.leader_kid, deputy_kid: c.deputy_kid }); }, ["kids", "caravans"]); }
  if (a === "kidrole") { const k = I.kid[t.dataset.k]; const car = I.car[k.caravan_id]; if (!car) return; ui.drawOpen = true;
    const before = S.caravans.map((c) => ({ id: c.id, leader_kid: c.leader_kid, deputy_kid: c.deputy_kid }));
    const patch = {}; if (car.leader_kid === k.id) patch.leader_kid = null; if (car.deputy_kid === k.id) patch.deputy_kid = null;
    if (t.value === "leader") patch.leader_kid = k.id; if (t.value === "deputy") patch.deputy_kid = k.id;
    return doUndoable("حُفظ الدور", async () => { await db.update("caravans", { id: car.id }, patch); await db.update("kids", { id: k.id }, { pinned: true }); return true; }, async () => { for (const c of before) await db.update("caravans", { id: c.id }, { leader_kid: c.leader_kid, deputy_kid: c.deputy_kid }); }, ["caravans", "kids"]); }
  if (a === "kidcar") { await guard(() => db.update("kids", { id: t.dataset.id }, { caravan_id: t.value ? Number(t.value) : null }), "نُقل المغامر"); await guard(() => reload("kids")); return render(); }
  if (a === "kidpos") { await guard(() => db.update("kids", { id: t.dataset.id }, { position: t.value || null }), "حُفظ المركز"); await guard(() => reload("kids")); return; }
  if (a === "kidtrait") { await guard(() => db.update("kids", { id: t.dataset.id }, { trait: t.value || null }), "حُفظ"); await guard(() => reload("kids")); return; }
  if (a === "measure") { const v = t.value === "" ? null : Number(t.value); const m = { kid_id: t.dataset.k, test: t.dataset.t, phase: t.dataset.p };
    if (v == null) await guard(() => db.remove("measures", m), "حُذف القياس"); else await guard(() => db.upsert("measures", [{ ...m, value: v }], "kid_id,test,phase"), "حُفظ القياس");
    await guard(() => reload("measures")); return render(); }
  if (a === "roundspirit") { await guard(() => db.upsert("league_rounds", [{ round: Number(t.dataset.r), spirit_kid: t.value || null }], "round"), "حُفظ لاعب الجولة"); await guard(() => reload("league_rounds")); return render(); }
  if (a === "perm") { const acc = accounts.find((x) => x.id === t.dataset.id); const perms = { ...(acc.perms || {}), [t.dataset.p]: t.checked }; await guard(() => db.rpc("decide_account", { target: acc.id, decision: "perms", new_perms: perms }), "حُفظت الصلاحية"); await guard(loadAccounts); return; }
});


// ---------------- أيقونات بطاقات القوة ----------------
const PSVG = {
  compass: '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 18 62 50 50 82 38 50z" fill="currentColor"/><circle cx="50" cy="50" r="6" fill="#0b1230"/>',
  target: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="9" fill="currentColor"/>',
  penalty: '<path d="M10 30h80v44" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M10 30v44" stroke="currentColor" stroke-width="7"/><path d="M22 42h56M22 56h56M36 30v44M64 30v44" stroke="currentColor" stroke-width="2.5" opacity=".55"/><circle cx="50" cy="86" r="9" fill="currentColor"/>',
  block: '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="9"/><path d="M24 76 76 24" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
  hero: '<circle cx="50" cy="22" r="13" fill="currentColor"/><path d="M50 38c-15 0-23 10-25 27l12 3 3 26h20l3-26 12-3c-2-17-10-27-25-27z" fill="currentColor"/><path d="M70 40l20-22" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
  swap: '<path d="M18 36h56l-14-14M82 64H26l14 14" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M50 8 16 22v26c0 24 16 40 34 46 18-6 34-22 34-46V22z" fill="currentColor"/><path d="M50 22 28 31v17c0 15 9 26 22 31z" fill="#fff" opacity=".35"/>',
  bolt: '<path d="M58 6 20 56h26l-8 38 42-54H54z" fill="currentColor" stroke-linejoin="round"/>',
  mirror: '<ellipse cx="50" cy="40" rx="26" ry="32" fill="none" stroke="currentColor" stroke-width="7"/><path d="M38 28c4-6 10-9 16-9" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".7"/><path d="M50 72v20M38 92h24" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
};
const picon = (kind) => powerIcon(kind);

// ---------------- دليل اللقاء ----------------
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
let planTimer = null;
function planNow(P, m) {
  const d = new Date(); const live = m.meet_date === isoLocal(d); const now = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  if (!live) return { live: false, cur: -1 };
  let cur = P.segs.findIndex((s) => now >= toMin(s.from) && now < toMin(s.to));
  const next = P.segs.findIndex((s) => toMin(s.from) > now);
  return { live: true, cur, next, now };
}
function planNowHTML(P, m) {
  const st = planNow(P, m); const tm = ui.ptimer;
  const tleft = tm ? Math.max(0, Math.ceil((tm.end - Date.now()) / 1000)) : 0;
  const timer = tm ? `<div class="pt-timer ${tleft === 0 ? "done" : ""}"><span>${esc(tm.label)}</span><b class="num">${String(Math.floor(tleft / 60)).padStart(2, "0")}:${String(tleft % 60).padStart(2, "0")}</b><button class="btn ghost sm" data-act="ptstop">إيقاف</button></div>` : "";
  if (!st.live) return timer + `<p class="muted small">الدليل يمشي مع الساعة يوم اللقاء (${fmtDate(m.meet_date)}). افتح أي فقرة تحت.</p>`;
  const s = P.segs[st.cur]; const n = P.segs[st.next];
  const left = s ? Math.max(0, Math.round(toMin(s.to) - st.now)) : 0;
  return timer + (s ? `<div class="pn-cur"><small>الحين · باقي <b class="num">${left}</b> د</small><h3>${esc(s.title)}</h3><p>${esc(s.place)} · ${esc(s.who)}</p></div>` : `<div class="pn-cur"><small>بين الفقرات</small><h3>${n ? "القادم: " + esc(n.title) : "انتهى اللقاء"}</h3></div>`)
    + (n && s ? `<div class="pn-next"><small>بعدها ${fmt12(n.from)}</small><b>${esc(n.title)}</b></div>` : "");
}
function viewPlan(arg) {
  const m = arg ? S.meetings.find((x) => x.number === Number(arg)) : I.meet[meetId];
  const P = m && planFor(m.number);
  if (!P) return ($app().innerHTML = shell(pageHead("دليل اللقاء", m ? `خطة اللقاء ${m.number} ما تجهزت بعد.` : "اختر لقاء.", meetPicker()), "plan"));
  const st = planNow(P, m);
  const list = (arr, cls) => (arr && arr.length ? `<ul class="${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const seg = (s, i) => {
    const on = i === st.cur; const open = on || (ui.planOpen ? ui.planOpen.has(i) : s.key);
    const timers = (s.timers || []).map(([lb, mn]) => `<button class="btn sm ghost" data-act="ptstart" data-l="${esc(lb)}" data-m="${mn}">⏱ ${esc(lb)} ${mn} د</button>`).join("");
    return `<details class="pseg k-${s.kind} ${on ? "now" : ""}" data-i="${i}" ${open ? "open" : ""}>
      <summary><span class="ps-time num">${fmt12(s.from)}<small>${fmt12(s.to)}</small></span><span class="ps-t"><b>${esc(s.title)}</b><small>${esc(s.place)} · ${esc(s.who)}</small></span>${on ? '<span class="ds-now">الحين</span>' : ""}</summary>
      <div class="ps-body">
        ${s.aim ? `<p class="ps-aim">🎯 ${esc(s.aim)}</p>` : ""}
        ${s.rule ? `<div class="ps-rule"><b>بطاقة القاعدة</b><p>${esc(s.rule)}</p>${s.why ? `<p class="muted small">ليش؟ ${esc(s.why)}</p>` : ""}</div>` : ""}
        ${s.levels ? `<div class="ps-lv">${s.levels.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>` : ""}
        ${timers ? `<div class="ps-timers">${timers}</div>` : ""}
        ${s.steps ? `<ol class="ps-steps">${s.steps.map(([t, d]) => { const live = st.live && st.now >= toMin(t) && on; return `<li class="${live ? "past" : ""}"><span class="num">${fmt12(t).replace(/ [صم]$/, "")}</span><p>${esc(d)}</p></li>`; }).join("")}</ol>` : ""}
        ${s.say && s.say.length ? `<div class="ps-say"><b>🗣️ تقول</b>${s.say.map((x) => `<q>${esc(x)}</q>`).join("")}</div>` : ""}
        <div class="ps-roles">${s.asst ? `<div><b>🧑‍🤝‍🧑 المساعد</b>${list(s.asst)}</div>` : ""}${s.leaders ? `<div><b>🎖️ القادة</b>${list(s.leaders)}</div>` : ""}</div>
        ${s.tools ? `<div class="ps-mini"><b>🧰 الأدوات</b>${list(s.tools)}</div>` : ""}
        ${s.safety ? `<div class="ps-mini safe"><b>🛟 السلامة</b>${list(s.safety)}</div>` : ""}
        ${s.points ? `<p class="ps-pts">⭐ ${esc(s.points)}</p>` : ""}
        ${s.alt ? `<p class="ps-alt">↺ البديل: ${esc(s.alt)}</p>` : ""}
      </div></details>`;
  };
  const O = P.official || {};
  const ofl = [["هدف اللقاء", O.goal || P.goal], ["كيف تعيش الفئة القيمة", O.live || P.live], ["فعالية الفئة 1", O.ev1], ["دور الفئة في الديوان", O.diwan], ["فعالية الفئة 2", O.ev2], ["الضيافة", O.meal], ["مع المختص", O.station], ["كرة القدم", O.football], ["رياضة وألعاب حركية", O.sport], ["الأدوات", (P.tools || []).join("\n")], ["دور المساعد", P.assistant], ["رابط التحضير", P.prepLink]].filter((x) => x[1]);
  $app().innerHTML = shell(`
    <section class="plan-hero"><div><p class="muted">اللقاء ${m.number} · الخميس ${fmtDate(m.meet_date)}</p><h1>${esc(P.title)}</h1><p>${esc(P.tagline)}</p>
      <div class="plan-chips"><span>💎 القيمة <b>${esc(P.value)}</b></span><span>👂 الديوان <b>${esc(P.diwanSkill)}</b></span><span>🥋 المحطة <b>${esc(P.station)}</b></span><span>⚽ الميدان <b>${esc(P.field)}</b></span></div></div>
      <div class="plan-now" id="plan-now">${planNowHTML(P, m)}</div></section>
    <section class="panel plan-goal"><p><b>هدف اللقاء:</b> ${esc(P.goal)}</p><p><b>كيف نعيش القيمة:</b> ${esc(P.live)}</p>
      <div class="plan-duty">${Object.entries(P.duties || {}).map(([c, d]) => `<span><b>${esc(c)}</b> ${esc(d)}</span>`).join("")}</div></section>
    <div class="psegs">${P.segs.map(seg).join("")}</div>
    <section class="panel"><h3>🧰 أدوات الليلة</h3>${list(P.tools, "checks")}<p><b>المساعد:</b> ${esc(P.assistant)}</p><p><b>سؤال التأمل:</b> ${esc(P.reflect)}</p><p><b>التحدي المنزلي:</b> ${esc(P.home)}</p></section>
    <details class="panel staff"><summary><h3>📤 نص المنصة الرسمية</h3></summary><p class="muted small">نفس الحقول اللي في «خطة الفئة للقاء». اضغط على أي حقل ينسخ.</p>
      <div class="ofl">${ofl.map(([k, v]) => `<button class="ofl-f" data-act="copy" data-v="${esc(v)}"><small>${esc(k)}</small><span>${esc(v)}</span></button>`).join("")}</div>
      <p><a href="${esc(P.prepLink)}" target="_blank" rel="noopener">صفحة التحضير العامة ↗</a></p></details>`, "plan");
  clearInterval(planTimer);
  planTimer = setInterval(() => { if (parseRoute().name !== "plan") return clearInterval(planTimer); const el = document.getElementById("plan-now"); if (el) el.innerHTML = planNowHTML(P, m);
    const s2 = planNow(P, m); document.querySelectorAll(".pseg").forEach((d) => d.classList.toggle("now", Number(d.dataset.i) === s2.cur));
    if (ui.ptimer && Date.now() >= ui.ptimer.end && !ui.ptimer.rang) { ui.ptimer.rang = true; try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {} } }, 1000);
}
document.addEventListener("toggle", (e) => { const d = e.target; if (!d.classList || !d.classList.contains("pseg")) return; ui.planOpen = ui.planOpen || new Set([...document.querySelectorAll(".pseg[open]")].map((x) => Number(x.dataset.i))); if (d.open) ui.planOpen.add(Number(d.dataset.i)); else ui.planOpen.delete(Number(d.dataset.i)); }, true);

// ---------------- بطاقات القوة: السحب بالحظ ----------------
function drawCardKind() { const r = crypto.getRandomValues(new Uint32Array(2)); return L.drawCard(r[0] / 4294967296, r[1] / 4294967296); }
function bigCard(kind, cls = "") {
  const p = L.POWER[kind]; if (!p) return "";
  return powerCard(kind, cls || "md");
}
function drawStage(kind, assign) {
  const p = L.POWER[kind];
  return `<div class="dstage t${p.tier}" role="dialog" aria-label="سحب بطاقة قوة"><div class="ds-glow"></div>
    <div class="ds-flip"><div class="ds-back">${powerBack()}<div class="ds-q">؟</div></div><div class="ds-front">${bigCard(kind)}</div></div>
    <p class="ds-tier">${L.TIER[p.tier]}!</p>
    ${assign ? `<div class="ds-give"><p>لمين تروح البطاقة؟</p><div>${S.caravans.map((c) => `<button class="btn" style="${carStyle(c)}" data-act="drawgive" data-car="${c.id}">${esc(c.name)}</button>`).join("")}</div><button class="btn ghost sm" data-act="drawcancel">ألغِ السحبة</button></div>` : ""}</div>`;
}
function viewCards() {
  const ed = can("points");
  const tiers = [1, 2, 3, 4].map((t) => `<div class="tier-k t${t}"><b>${L.TIER[t]}</b><span class="num">${L.TIER_W[t]}%</span><small>${Object.keys(L.POWER).filter((k) => L.POWER[k].tier === t).map((k) => esc(L.POWER[k].name)).join("، ")}</small></div>`).join("");
  const cars = S.caravans.map((c) => { const all = L.cardsOf(S, c.id); const free = all.filter((p) => !L.cardUsed(p)); const used = all.filter((p) => L.cardUsed(p));
    return `<section class="panel cardcar" style="${carStyle(c)}"><header><h3>${esc(c.name)}</h3><span>🎴 <b class="num">${free.length}</b></span></header>
      <div class="cc-list">${free.map((p) => `<div class="cc-item t${L.POWER[p.kind].tier}">${picon(p.kind)}<span><b>${esc(L.POWER[p.kind].name)}</b><small>${L.TIER[L.POWER[p.kind].tier]}</small></span>${ed ? `<button class="chip" data-act="cardused" data-id="${p.id}">✓ استُخدمت</button><button class="x" data-act="carddrawdel" data-id="${p.id}" aria-label="حذف">×</button>` : ""}</div>`).join("") || '<p class="muted small">ما عندها بطاقات.</p>'}</div>
      ${used.length ? `<p class="muted small">استُخدمت: ${used.map((p) => `${esc(L.POWER[p.kind].name)}${ed && p.used_at && !p.used_match_id ? ` <button class="x" data-act="cardused" data-id="${p.id}" aria-label="رجّعها">↩︎</button>` : ""}`).join("، ")}</p>` : ""}</section>`; }).join("");
  $app().innerHTML = shell(`
    ${pageHead("بطاقات القوة", "تسحب بالحظ متى ما قررت، وتختار القافلة اللي تروح لها.", ed ? `<button class="btn pw-draw" data-act="draw2">🎲 اسحب بطاقة</button>` : "")}
    <div class="tier-keys">${tiers}</div>
    <div class="cardcars">${cars}</div>
    <section class="panel"><h3>القواعد في الملعب</h3><ul><li>كل قافلة تلعب بطاقة وحدة بالمباراة، يعلنها الكابتن للحكم قبل البداية أو بين الشوطين.</li><li>المرآة والتعطيل تنلعب ردًّا لحظة ما الخصم يعلن بطاقته.</li><li>بعد المباراة البطاقة ترجع لك، وتسجّلها «استُخدمت».</li></ul>
      <div class="pc-row">${Object.keys(L.POWER).map((k) => bigCard(k, "sm")).join("")}</div><p><a class="btn ghost sm" href="#print/deck">🖨️ اطبع البطاقات (${Object.values(L.DECK).reduce((a, b) => a + b, 0)} بطاقة)</a></p></section>
    ${ui.drawn ? drawStage(ui.drawn.kind, true) : ""}`, "cards");
}

// ---------------- القرعة ----------------
function computeDraw() {
  const kids = L.activeKids(S); const cars = S.caravans.slice().sort((a, b) => a.sort - b.sort);
  const lockCar = {}; cars.forEach((c) => { [c.leader_kid, c.deputy_kid].forEach((id) => { if (id) lockCar[id] = c.id; }); });
  const plan = {}; const size = Object.fromEntries(cars.map((c) => [c.id, 0])); const fam = Object.fromEntries(cars.map((c) => [c.id, new Set()]));
  const put = (k, cid) => { plan[k.id] = cid; size[cid]++; if (k.family_name) fam[cid].add(k.family_name.trim()); };
  kids.forEach((k) => { const cid = lockCar[k.id] || (k.pinned && k.caravan_id ? k.caravan_id : null); if (cid && size[cid] != null) put(k, cid); });
  const rest = kids.filter((k) => plan[k.id] == null); const rnd = crypto.getRandomValues(new Uint32Array(rest.length + cars.length * 4));
  rest.forEach((k, i) => (k._r = rnd[i])); rest.sort((a, b) => a._r - b._r);
  let j = rest.length;
  for (const k of rest) {
    const min = Math.min(...cars.map((c) => size[c.id]));
    let opts = cars.filter((c) => size[c.id] === min);
    const nf = opts.filter((c) => !(k.family_name && fam[c.id].has(k.family_name.trim()))); if (nf.length) opts = nf;
    put(k, opts[rnd[j++ % rnd.length] % opts.length].id);
  }
  return plan;
}
function drawPanel() {
  const kids = L.activeKids(S).slice().sort((a, b) => L.kidName(a).localeCompare(L.kidName(b), "ar")); const plan = ui.drawPlan;
  const roleOf = (k) => { const c = S.caravans.find((x) => x.leader_kid === k.id || x.deputy_kid === k.id); return c ? (c.leader_kid === k.id ? "leader" : "deputy") : ""; };
  const pinnedN = kids.filter((k) => k.pinned || roleOf(k)).length;
  const rows = kids.map((k) => { const r = roleOf(k); const pin = k.pinned || !!r;
    return `<tr class="${pin ? "pinrow" : ""}"><td>${esc(L.kidName(k))}</td>
      <td><label class="pin"><input type="checkbox" data-act="kidpin" data-k="${k.id}" ${pin ? "checked" : ""} ${r ? "disabled" : ""}> مثبّت</label></td>
      <td><select data-act="kidpincar" data-k="${k.id}" ${pin ? "" : "disabled"}><option value="">—</option>${S.caravans.map((c) => `<option value="${c.id}" ${k.caravan_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></td>
      <td><select data-act="kidrole" data-k="${k.id}" ${pin && k.caravan_id ? "" : "disabled"}><option value="">عضو</option><option value="leader" ${r === "leader" ? "selected" : ""}>🎖️ قائد</option><option value="deputy" ${r === "deputy" ? "selected" : ""}>🔰 نائب</option></select></td></tr>`; }).join("");
  const preview = plan ? `<div class="draw-prev">${S.caravans.map((c) => { const ks = kids.filter((k) => plan[k.id] === c.id);
      return `<section style="${carStyle(c)}"><h4>${esc(c.name)} <span class="num">${ks.length}</span></h4><ul>${ks.map((k) => { const r = roleOf(k); return `<li class="${k.pinned || r ? "pin" : ""}">${r === "leader" ? "🎖️ " : r === "deputy" ? "🔰 " : k.pinned ? "📌 " : ""}${esc(L.kidName(k))}</li>`; }).join("")}</ul></section>`; }).join("")}</div>
      <div class="row-btns"><button class="btn" data-act="drawapply">اعتمد القرعة</button><button class="btn ghost" data-act="drawrun">اسحب من جديد</button><button class="btn ghost" data-act="drawcancel2">إلغاء</button></div>` : "";
  return `<details class="panel tools-box" ${ui.drawOpen || plan ? "open" : ""} data-box="draw"><summary><h3>🎲 قرعة القوافل</h3></summary>
    <p class="muted small">ثبّت اللي تبيهم في قافلة معيّنة (والقائد والنائب ثابتين تلقائيًا)، والباقي ينسحب بالحظ بحيث القوافل تتساوى بالعدد، ويتفرق الإخوة إذا أمكن. تشوف النتيجة قبل ما تعتمدها، وبعدها تعلنها من الشاشة ← «الإعلان».</p>
    <p><b class="num">${pinnedN}</b> مثبّت من <b class="num">${kids.length}</b></p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المغامر</th><th>تثبيت</th><th>القافلة</th><th>الدور</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${plan ? preview : `<div class="row-btns"><button class="btn" data-act="drawrun">🎲 اسحب الباقي</button><a class="btn ghost" href="#screen" data-act="anngo">📺 شاشة الإعلان</a></div>`}</details>`;
}

// ---------------- شاشة الإعلان ----------------
function annSteps() { const out = []; S.caravans.forEach((c) => { out.push({ c, ph: "name" }, { c, ph: "lead" }, { c, ph: "all" }); }); out.push({ ph: "grid" }); return out; }
function announceHTML() {
  const steps = annSteps(); const i = Math.max(0, Math.min(steps.length - 1, ui.ann || 0)); const s = steps[i];
  const nm = (id) => (id && I.kid[id] ? esc(L.kidName(I.kid[id])) : "—");
  let body;
  if (s.ph === "grid") body = `<div class="ann-grid">${S.caravans.map((c) => `<section style="${carStyle(c)}"><h2>${esc(c.name)}</h2><p>🎖️ ${nm(c.leader_kid)} · 🔰 ${nm(c.deputy_kid)}</p><ul>${L.kidsOf(S, c.id).filter((k) => k.id !== c.leader_kid && k.id !== c.deputy_kid).map((k) => `<li>${esc(k.first_name)}</li>`).join("")}</ul></section>`).join("")}</div>`;
  else {
    const c = s.c; const mem = L.kidsOf(S, c.id).filter((k) => k.id !== c.leader_kid && k.id !== c.deputy_kid);
    body = `<div class="ann-car ph-${s.ph}" style="${carStyle(c)}"><p class="ann-k">قافلة</p><h2 class="ann-name">${esc(c.name.replace(/[\u064B-\u0652]/g, ""))}</h2>
      ${s.ph !== "name" ? `<div class="ann-lead"><div><small>🎖️ القائد</small><b>${nm(c.leader_kid)}</b></div><div><small>🔰 النائب</small><b>${nm(c.deputy_kid)}</b></div></div>` : ""}
      ${s.ph === "all" ? `<ul class="ann-mem">${mem.map((k, j) => `<li style="animation-delay:${0.25 + j * 0.35}s">${esc(L.kidName(k))}</li>`).join("")}</ul>` : ""}</div>`;
  }
  return `<div class="ann">${body}<nav class="ann-nav"><button data-act="annprev" aria-label="السابق">→</button><span class="num">${i + 1}/${steps.length}</span><button data-act="annnext" aria-label="التالي">←</button></nav></div>`;
}
document.addEventListener("keydown", (e) => {
  if (parseRoute().name !== "screen" || ui.screenTab !== "announce") return;
  if ([" ", "Enter", "ArrowLeft", "PageDown"].includes(e.key)) { e.preventDefault(); ui.ann = Math.min(annSteps().length - 1, (ui.ann || 0) + 1); viewScreen(); }
  if (["ArrowRight", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); ui.ann = Math.max(0, (ui.ann || 0) - 1); viewScreen(); }
});

// ---------------- boot ----------------
window.addEventListener("hashchange", render);
(async function boot() {
  const type = auth.consumeHash();
  if (type) { history.replaceState(null, "", location.pathname + (type === "recovery" ? "#reset" : "#home")); }
  if (auth.session) { await guard(() => auth.loadUser()); }
  render();
})();
