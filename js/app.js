import { auth, db, ApiError } from "./api.js";
import * as L from "./logic.js";

// ---------------- state ----------------
const TABLES = ["caravans", "kids", "meetings", "points", "deductions", "team_challenge", "matches", "goals", "cards", "league_rounds", "badges", "measures", "kid_notes"];
let S = null, I = null, me = null, accounts = [];
let meetId = null;
let ui = { liveCar: "all", kidsQ: "", kidsCar: "all", leagueTab: "matches", screenTab: "caravans", openDed: null, openMatch: null, armed: null };
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

function toast(msg, kind = "ok") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.className = "toast " + kind + " show";
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), kind === "err" ? 5000 : 2200);
}
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
const NAV = [
  ["home", "الرئيسية", () => true],
  ["live", "وضع اللقاء", () => can("points")],
  ["caravans", "القوافل", () => true],
  ["league", "الدوري", () => true],
  ["kids", "المغامرون", () => true],
  ["reports", "التقارير", () => true],
  ["accounts", "الحسابات", () => isOwner()],
];

let screenTimer = null;
async function render() {
  clearInterval(screenTimer); screenTimer = null;
  const r = parseRoute();
  document.body.classList.toggle("is-screen", r.name === "screen");
  if (["login", "signup", "forgot", "reset"].includes(r.name) || !auth.session) {
    if (r.name === "reset" && auth.session) return viewReset();
    if (!auth.session) return r.name === "signup" ? viewSignup() : r.name === "forgot" ? viewForgot() : viewLogin();
  }
  if (!me) { await guard(loadMe); }
  if (!me) return viewLogin("ما قدرنا نجيب بيانات حسابك. سجّل الدخول من جديد.");
  if (me.status !== "approved") return viewPending();
  if (!S) { $app().innerHTML = shell('<div class="empty">جاري تحميل البيانات…</div>'); await guard(loadAll); if (!S) return; if (isOwner()) await guard(loadAccounts); }
  else if (r.name === "accounts" && isOwner()) await guard(loadAccounts);
  const views = { home: viewHome, live: viewLive, caravans: viewCaravans, league: viewLeague, kids: viewKids, kid: viewKid, reports: viewReports, accounts: viewAccounts, screen: viewScreen, profile: viewProfile };
  const fn = views[r.name] || viewHome;
  if (r.name === "live" && !can("points")) return go("home");
  if (r.name === "accounts" && !isOwner()) return go("home");
  fn(r.arg);
}
function go(name) { if (location.hash !== "#" + name) location.hash = name; else render(); }

// ---------------- layout ----------------
function shell(inner, active) {
  const pend = isOwner() ? accounts.filter((a) => a.status === "pending").length : 0;
  const nav = NAV.filter((n) => n[2]()).map((n) => `<a href="#${n[0]}" class="${n[0] === active ? "on" : ""}">${n[1]}${n[0] === "accounts" && pend ? ` <b class="dot-n">${pend}</b>` : ""}</a>`).join("");
  return `
  <header class="top">
    <div class="wrap top-in">
      <a class="brand" href="#home" aria-label="الرئيسية"><img src="assets/mahara.png" alt="نادي مهارة"><span><b>المغامرون</b><small>حي الهجرة</small></span></a>
      <nav class="nav" aria-label="الأقسام">${nav}<a href="#screen" class="scr">الشاشة</a></nav>
      <a class="who" href="#profile" title="حسابي"><span>${esc(me.full_name || me.email)}</span><small>${ROLE_AR[me.role] || ""}</small></a>
    </div>
    <div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </header>
  <main class="wrap main">${inner}</main>`;
}
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
function viewHome() {
  const m = I.meet[meetId];
  const act = L.activeKids(S);
  const pres = m ? act.filter((k) => L.recorded(I, m.id, k.id) && L.present(I, m.id, k.id)).length : 0;
  const pend = isOwner() ? accounts.filter((a) => a.status === "pending") : [];
  const cars = S.caravans.map((c) => { const t = L.teamTotals(S, I, c.id); const r = m ? L.teamMeet(S, I, m.id, c.id) : null; return `<a class="car-mini" href="#caravans" style="${carStyle(c)}"><b>${esc(c.name)}</b><span class="num">⭐ ${t.stars}</span><small>${r && r.stars ? (r.stars === 2 ? "🌟 ذهبية في هذا اللقاء" : "⭐ نجمة في هذا اللقاء") : "رصيد " + t.bal}</small></a>`; }).join("");
  const next = S.matches.filter((x) => x.meeting_id === meetId);
  $app().innerHTML = shell(`
    <section class="hero">
      <div class="hero-txt"><p class="muted">أهلًا ${esc((me.full_name || "").split(" ")[0])}</p>
        <h1>${m ? `اللقاء ${m.number} · الخميس ${fmtDate(m.meet_date)}` : "لا توجد لقاءات"}</h1>
        ${m && (m.theme || m.skill) ? `<p class="muted">${m.theme ? "الموضوع: " + esc(m.theme) : ""}${m.theme && m.skill ? " · " : ""}${m.skill ? "المهارة: " + esc(m.skill) : ""}</p>` : ""}
      </div>${meetPicker()}
    </section>
    ${pend.length ? `<a class="notice" href="#accounts"><b>${pend.length}</b> ${pend.length === 1 ? "حساب ينتظر موافقتك" : "حسابات تنتظر موافقتك"}</a>` : ""}
    <div class="quick">
      ${can("points") ? `<a class="qa qa-main" href="#live"><b>ابدأ وضع اللقاء</b><span>الحضور والنقاط والإنذار من جوالك</span></a>` : ""}
      <a class="qa" href="#screen"><b>افتح الشاشة</b><span>للتلفاز: القوافل والترتيب والدوري</span></a>
      <a class="qa" href="#league"><b>الدوري</b><span>${next.length ? next.length + " مباراة في هذا اللقاء" : "الجدول والترتيب والجوائز"}</span></a>
    </div>
    <div class="stats">
      <div class="stat"><span>المغامرون النشطون</span><b class="num">${act.length}</b></div>
      <div class="stat"><span>حضور هذا اللقاء</span><b class="num">${m && act.some((k) => L.recorded(I, m.id, k.id)) ? pres + " / " + act.length : "لم يُسجّل"}</b></div>
      <div class="stat"><span>مباريات الدوري المنتهية</span><b class="num">${S.matches.filter((x) => x.played).length} / ${S.matches.length}</b></div>
    </div>
    <h2 class="h2">القوافل</h2><div class="car-grid">${cars}</div>`, "home");
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
      <div class="kwho"><a href="#kid/${k.id}" class="nm">${esc(L.kidName(k))}</a><small>${k.official ? "" : '<span class="tag">غير مسجّل</span> '}${role ? esc(role[1]) + " · " : ""}<span class="num">${n}/${L.NC}</span> · المجموع <span class="num">${L.kidTotal(S, I, k.id)}</span></small></div>
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
    <header><h3>${esc(c.name)}</h3><span class="st">${st}</span></header>
    ${rows || '<p class="muted pad">لا يوجد مغامرون في هذي القافلة.</p>'}
    <footer><span>نقاط التحديات</span><button class="step" data-act="tc" data-car="${c.id}" data-d="-5" aria-label="نقص 5">−</button><output class="num">${r.ch}</output><button class="step" data-act="tc" data-car="${c.id}" data-d="5" aria-label="زد 5">+</button><small class="muted">أساسي 10 · متقدم 15 · خبير 20</small></footer>
  </section>`;
}

// ---------------- screen (TV) ----------------
function viewScreen() {
  const m = I.meet[meetId];
  const tabs = [["caravans", "القوافل"], ["people", "المغامرون"], ["league", "الدوري"]];
  let body = "";
  if (ui.screenTab === "caravans") {
    body = `<div class="tv-cars">${S.caravans.map((c) => {
      const t = L.teamTotals(S, I, c.id); const r = m ? L.teamMeet(S, I, m.id, c.id) : { stars: 0, ready: 0, n: 0 };
      const pos = Math.min(L.ROAD.length - 1, t.stars);
      const road = L.ROAD.map((_, i) => `${i ? `<i class="${i <= pos ? "on" : ""}"></i>` : ""}<b class="${i < pos ? "on" : ""} ${i === pos ? "here" : ""}">${i === pos ? "🐪" : ""}</b>`).join("");
      const rk = L.ranked(S, I, L.kidsOf(S, c.id), m && m.id);
      const pct = r.n ? Math.round((r.ready / r.n) * 100) : 0;
      return `<section class="tv-col ${r.stars ? "star" : ""}" style="${carStyle(c)}">
        <header><h2>${esc(c.name)}</h2><span class="num">⭐ ${t.stars}</span></header>
        <div class="road" aria-label="موقع القافلة: ${esc(L.ROAD[pos])}">${road}</div>
        <ol class="tv-kids">${rk.map((x) => { const p = m ? L.row(I, m.id, x.k.id) || {} : {}; const pr = m ? L.present(I, m.id, x.k.id) : true; return `<li class="${pr ? "" : "abs"}"><span class="rk num">${x.rank}</span><span class="nm">${esc(x.k.first_name)}</span><span class="pips">${L.CATS.map((cc) => `<i class="${p[cc[0]] ? "on" : ""}" style="--c:${cc[2]}"></i>`).join("")}</span><b class="num">${x.tot}</b></li>`; }).join("")}</ol>
        <footer><b>${r.stars === 2 ? "🌟 نجمة ذهبية هذا اللقاء" : r.stars === 1 ? "⭐ نجمة هذا اللقاء" : `جاهزون للنجمة <span class="num">${r.ready} من ${r.n}</span>`}</b><div class="prog"><i style="width:${pct}%"></i></div><span>رصيد القافلة <b class="num">${t.bal}</b> · ${esc(L.ROAD[pos])}</span></footer>
      </section>`; }).join("")}</div>`;
  } else if (ui.screenTab === "people") {
    const rk = L.ranked(S, I, L.activeKids(S), m && m.id);
    body = `<div class="tv-people">${rk.map((x) => `<div class="tv-p ${x.rank <= 3 ? "top" + x.rank : ""}" style="${carStyle(I.car[x.k.caravan_id])}"><span class="rk num">${x.rank}</span><span class="nm">${esc(x.k.first_name)} <small>${esc(carName(x.k.caravan_id))}</small></span><b class="num">${x.tot}</b></div>`).join("")}</div>`;
  } else {
    const st = L.standings(S); const sc = L.scorers(S).slice(0, 5);
    body = `<div class="tv-league"><table class="tbl big"><thead><tr><th>القافلة</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>لعب نظيف</th><th>النقاط</th></tr></thead><tbody>${st.map((s, i) => `<tr><td><span class="sw" style="${carStyle(I.car[s.id])}"></span>${i === 0 && s.p ? "🏆 " : ""}${esc(carName(s.id))}</td><td class="num">${s.p}</td><td class="num">${s.w}</td><td class="num">${s.d}</td><td class="num">${s.l}</td><td class="num">${s.gf}</td><td class="num">${s.ga}</td><td class="num">${s.fair}</td><td class="num"><b>${s.pts}</b></td></tr>`).join("")}</tbody></table>
      <div class="tv-side"><h3>⚽ الهدافون</h3>${sc.length ? `<ol>${sc.map((x) => `<li>${esc(L.kidName(I.kid[x.kid]))} <b class="num">${x.n}</b></li>`).join("")}</ol>` : '<p class="muted">لا أهداف بعد</p>'}
      <h3>🟦 بطاقات الأمانة</h3><p class="num big-n">${S.cards.filter((c) => c.color === "blue").length}</p></div></div>`;
  }
  $app().innerHTML = `<div class="tv">
    <header class="tv-top"><img src="assets/mahara.png" alt="نادي مهارة"><h1>${m ? `اللقاء ${m.number} · ${fmtDate(m.meet_date)}` : "المغامرون"}</h1>
      <div class="seg dark" role="group" aria-label="العرض">${tabs.map((t) => `<button data-act="scrtab" data-v="${t[0]}" aria-pressed="${ui.screenTab === t[0]}">${t[1]}</button>`).join("")}</div>
      <a class="tv-exit" href="#home">خروج</a></header>
    ${body}
    <p class="tv-legend">${L.CATS.map((c) => `<span><i class="dot" style="--c:${c[2]}"></i>${c[1]}</span>`).join("")}<span>⭐ كل القافلة ${L.NC - 1} نقاط فأكثر</span><span>🌟 كل القافلة ${L.NC}</span></p>
  </div>`;
  screenTimer = setInterval(async () => { if (parseRoute().name !== "screen") return; try { await reload("points", "deductions", "team_challenge", "matches", "goals", "cards", "kids", "caravans", "league_rounds"); viewScreen(); } catch (e) {} }, 10000);
}

// ---------------- caravans ----------------
function viewCaravans() {
  const m = I.meet[meetId]; const edit = can("kids");
  const cards = S.caravans.map((c) => {
    const ks = L.kidsOf(S, c.id); const t = L.teamTotals(S, I, c.id);
    return `<section class="ccard" style="${carStyle(c)}">
      <header><h3>${esc(c.name)}</h3><span class="num">⭐ ${t.stars} · رصيد ${t.bal}</span></header>
      ${edit ? `<div class="cform"><label>الاسم<input id="cn-${c.id}" value="${esc(c.name)}" maxlength="20"></label><label>اللون<input id="cc-${c.id}" type="color" value="${esc(c.color)}"></label>
        <label class="wide">الصيحة<input id="ch-${c.id}" value="${esc(c.chant || "")}" maxlength="60" placeholder="3 كلمات"></label>
        <label class="wide">الميثاق<textarea id="ct-${c.id}" rows="2" maxlength="300" placeholder="3 قواعد اتفقت عليها القافلة">${esc(c.charter || "")}</textarea></label>
        <button class="btn sm" data-act="carsave" data-id="${c.id}">حفظ القافلة</button></div>`
        : `${c.chant ? `<p><b>الصيحة:</b> ${esc(c.chant)}</p>` : ""}${c.charter ? `<p><b>الميثاق:</b> ${esc(c.charter)}</p>` : ""}`}
      <table class="tbl"><thead><tr><th>المغامر</th><th>دور هذا اللقاء</th><th>المجموع</th></tr></thead><tbody>
      ${ks.map((k) => { const r = m ? L.roleOf(S, k, m.number) : null; return `<tr><td><a href="#kid/${k.id}">${esc(L.kidName(k))}</a> ${k.trait ? `<span class="trait">${esc(k.trait)}</span>` : ""}${k.position ? ` <small class="muted">${esc(L.POSITIONS[k.position])}</small>` : ""}</td><td>${r ? esc(r[1]) : "—"}</td><td class="num">${L.kidTotal(S, I, k.id)}</td></tr>`; }).join("") || '<tr><td colspan="3" class="muted">لا يوجد مغامرون</td></tr>'}
      </tbody></table></section>`;
  }).join("");
  const plan = ui.balancePlan;
  $app().innerHTML = shell(`
    <section class="bar"><h1 class="h1">القوافل</h1>${meetPicker()}</section>
    <p class="muted">الأدوار تتناوب تلقائيًا كل لقاء داخل القافلة، فيجرّب كل مغامر كل دور.</p>
    ${edit ? `<section class="panel"><h3>توزيع متوازن</h3><p class="muted small">قاعدة العدالة: <b>الحارس الثابت ميزة، والعدد الأكبر ميزة، وما تجتمع الميزتان في قافلة وحدة.</b> كل قافلة تاخذ حارس ثابت واحد إذا توفر، والقافلة اللي بدون حارس ثابت (يتناوبون على المرمى) تاخذ اللاعب الزايد إذا العدد ما انقسم بالتساوي. بعدها يتوزع الدفاع والوسط والهجوم بأقل فرق ممكن بين القوافل، ويُفصل من يحملون نفس اسم العائلة، ويبقى الطفل في قافلته الحالية إذا تساوت الخيارات. تراجعه قبل الاعتماد، وتقدر تغيّر أي طفل بعدها.</p>${(() => { const gk = L.activeKids(S).filter((k) => k.position === "gk").length; return gk < S.caravans.length ? `<p class="alert">عندك ${gk} حراس لـ${S.caravans.length} قوافل، فـ${S.caravans.length - gk} قافلة بتلعب بحارس متناوب، ولها الأفضلية في العدد إذا ما انقسم بالتساوي.</p>` : ""; })()}
      ${plan ? `<table class="tbl"><thead><tr><th>المغامر</th><th>المركز</th><th>الحرف</th><th>الحالية</th><th>المقترحة</th></tr></thead><tbody>${L.activeKids(S).slice().sort((a, b) => String(plan[a.id]).localeCompare(String(plan[b.id]))).map((k) => `<tr class="${plan[k.id] !== k.caravan_id ? "chg" : ""}"><td>${esc(L.kidName(k))}</td><td>${esc(L.POSITIONS[k.position] || "—")}</td><td>${esc(k.trait || "—")}</td><td>${esc(carName(k.caravan_id))}</td><td><b>${esc(carName(plan[k.id]))}</b></td></tr>`).join("")}</tbody></table>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>القافلة</th><th>العدد</th><th>الحارس الثابت</th><th>دفاع</th><th>وسط</th><th>هجوم</th><th>بدون مركز</th></tr></thead><tbody>${L.balanceSummary(S, plan).map((x) => `<tr><td><span class="sw" style="${carStyle(x.c)}"></span>${esc(x.c.name)}</td><td class="num"><b>${x.size}</b></td><td>${x.gk ? esc(L.kidName(x.gk)) : "<b>حارس متناوب</b>"}</td><td class="num">${x.def}</td><td class="num">${x.mid}</td><td class="num">${x.fwd}</td><td class="num">${x.none}</td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn" data-act="balapply">اعتمد التوزيع</button><button class="btn ghost" data-act="balcancel">إلغاء</button></div>`
        : `<button class="btn ghost" data-act="balance">اقترح توزيعًا متوازنًا</button>`}</section>` : ""}
    <div class="ccards">${cards}</div>`, "caravans");
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
    ${list.map((k) => { const at = L.kidAttendance(S, I, k.id); if (edit && ui.editKid === k.id) return `<tr><td colspan="7"><div class="addrow"><input id="ek-first" value="${esc(k.first_name)}" maxlength="30" aria-label="الاسم الأول"><input id="ek-fam" value="${esc(k.family_name)}" maxlength="30" aria-label="اسم العائلة"><label class="chk"><input id="ek-off" type="checkbox" ${k.official ? "checked" : ""}> مسجّل في المنصة الرسمية</label><button class="btn sm" data-act="kidsave" data-id="${k.id}">حفظ</button><button class="btn ghost sm" data-act="kidedit" data-id="">إلغاء</button></div></td></tr>`;
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
  const rk = L.ranked(S, I, L.kidsOf(S, k.caravan_id)).find((x) => x.k.id === k.id);
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
        <div class="pp-nums"><div><b class="num">${tot}</b><span>نقطة</span></div><div><b class="num">${rk ? rk.rank : "—"}</b><span>ترتيبه في القافلة</span></div><div><b class="num">${at.total ? at.came + "/" + at.total : "—"}</b><span>حضور</span></div></div></header>
      <section><h2 class="h2">أختام اللقاءات</h2><div class="stamps">${stamps}</div></section>
      <section><h2 class="h2">بطاقاته</h2><div class="cat-bars">${catTot.map(([cat, n]) => `<div><span>${cat[1]}</span><div class="cbar"><i style="width:${Math.min(100, (n / Math.max(1, S.meetings.length)) * 100)}%;background:${cat[2]}"></i></div><b class="num">${n}</b></div>`).join("")}</div></section>
      <section><h2 class="h2">الشارات</h2>${bs.length ? `<ul class="badges">${bs.map((b) => `<li><b>${esc(L.BADGES[b.badge])}</b><span>${esc(b.evidence)}</span>${b.meeting_id && I.meet[b.meeting_id] ? `<small>اللقاء ${I.meet[b.meeting_id].number}</small>` : ""}${edit ? `<button class="x" data-act="badgedel" data-id="${b.id}" aria-label="حذف الشارة">×</button>` : ""}</li>`).join("")}</ul>` : '<p class="muted">لم يحصل على شارة بعد. كل شارة تُعطى بشاهد سلوك أو إنجاز.</p>'}
        ${edit ? `<div class="addrow"><select id="bd-type" aria-label="الشارة">${Object.entries(L.BADGES).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select><input id="bd-ev" placeholder="الشاهد: موقف أو إنجاز محدد" maxlength="140" aria-label="الشاهد"><button class="btn" data-act="badgeadd" data-k="${k.id}">منح الشارة</button></div>` : ""}</section>
      <section><h2 class="h2">خماسي القدرات: قبل وبعد</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>القدرة</th><th>قبل</th><th>بعد</th><th>التحسّن</th></tr></thead><tbody>
        ${Object.entries(L.TESTS).map(([t, info]) => { const pre = ms[t + "|pre"], post = ms[t + "|post"]; let imp = "—"; if (pre != null && post != null) { const d = info.lowerBetter ? pre - post : post - pre; imp = d > 0 ? `<span class="up">▲ ${+d.toFixed(2)} ${info.unit}</span>` : d < 0 ? `<span class="down">▼ ${+Math.abs(d).toFixed(2)}</span>` : "ثابت"; }
          const cell = (ph, v) => edit ? `<input class="mini num" type="number" step="0.1" inputmode="decimal" value="${v ?? ""}" data-act="measure" data-k="${k.id}" data-t="${t}" data-p="${ph}" aria-label="${info.name} ${ph === "pre" ? "قبل" : "بعد"}">` : `<span class="num">${v ?? "—"}</span>`;
          return `<tr><td>${info.name}<small class="muted"> (${info.unit})</small></td><td>${cell("pre", pre)}</td><td>${cell("post", post)}</td><td>${imp}</td></tr>`; }).join("")}
      </tbody></table></div><p class="muted small">السرعة والرشاقة: الأقل أفضل. الباقي: الأكثر أفضل. المقارنة مع نفسه فقط.</p></section>
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
    <div class="mmeta">${side(m.home_id).concat(side(m.away_id)).map((g) => `⚽ ${esc(I.kid[g.kid_id].first_name)}`).join(" · ")}${cards.length ? " " + cards.map((c) => `${c.color === "blue" ? "🟦" : c.color === "yellow" ? "🟨" : "🟥"} ${esc(I.kid[c.kid_id] ? I.kid[c.kid_id].first_name : "")}`).join(" · ") : ""}${m.spirit_kid && I.kid[m.spirit_kid] ? ` · 🏅 ${esc(I.kid[m.spirit_kid].first_name)}` : ""}</div>
    ${open && edit ? `<div class="medit">
      <div class="grid2"><label>الفريق الأول<select id="mth-${m.id}">${S.caravans.map((c) => `<option value="${c.id}" ${c.id === m.home_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>الفريق الثاني<select id="mta-${m.id}">${S.caravans.map((c) => `<option value="${c.id}" ${c.id === m.away_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div>
      <div class="grid2"><label>الجولة<input id="mr-${m.id}" type="number" min="1" max="20" value="${m.round}"></label><label>اللقاء<select id="mm-${m.id}">${S.meetings.map((x) => `<option value="${x.id}" ${x.id === m.meeting_id ? "selected" : ""}>اللقاء ${x.number} · ${fmtDate(x.meet_date)}</option>`).join("")}</select></label></div>
      <div class="scoreline"><label>${esc(h.name)}<input id="mh-${m.id}" type="number" min="0" max="50" inputmode="numeric" value="${m.home_goals ?? ""}"></label><label>${esc(a.name)}<input id="ma-${m.id}" type="number" min="0" max="50" inputmode="numeric" value="${m.away_goals ?? ""}"></label></div>
      <div class="grid2"><label>حارس ${esc(h.name)}<select id="mkh-${m.id}">${kidOpt(L.kidsOf(S, m.home_id), m.home_keeper)}</select></label><label>حارس ${esc(a.name)}<select id="mka-${m.id}">${kidOpt(L.kidsOf(S, m.away_id), m.away_keeper)}</select></label></div>
      <div class="grid2"><label class="chk"><input id="mfh-${m.id}" type="checkbox" ${m.fair_home ? "checked" : ""}> لعب نظيف لـ${esc(h.name)} (+1)</label><label class="chk"><input id="mfa-${m.id}" type="checkbox" ${m.fair_away ? "checked" : ""}> لعب نظيف لـ${esc(a.name)} (+1)</label></div>
      <label>🏅 لاعب الروح الرياضية في المباراة<select id="msp-${m.id}">${kidOpt(both, m.spirit_kid)}</select></label>
      <button class="btn" data-act="msave" data-id="${m.id}">حفظ النتيجة</button>
      <div class="sub"><h4>الأهداف</h4><ul class="mini-list">${goals.map((g) => `<li>⚽ ${esc(L.kidName(I.kid[g.kid_id]))}<button class="x" data-act="goaldel" data-id="${g.id}" aria-label="حذف الهدف">×</button></li>`).join("") || '<li class="muted">لا أهداف</li>'}</ul>
        <div class="addrow"><select id="mg-${m.id}" aria-label="من سجّل">${kidOpt(both)}</select><button class="btn sm" data-act="goaladd" data-id="${m.id}">+ هدف</button></div></div>
      <div class="sub"><h4>البطاقات</h4><ul class="mini-list">${cards.map((c) => `<li>${c.color === "blue" ? "🟦 أمانة" : c.color === "yellow" ? "🟨 صفراء" : "🟥 حمراء"} · ${esc(L.kidName(I.kid[c.kid_id]))}${c.reason ? " · " + esc(c.reason) : ""}<button class="x" data-act="carddel" data-id="${c.id}" aria-label="حذف البطاقة">×</button></li>`).join("") || '<li class="muted">لا بطاقات</li>'}</ul>
        <div class="addrow"><select id="mck-${m.id}" aria-label="اللاعب">${kidOpt(both)}</select><select id="mcc-${m.id}" aria-label="لون البطاقة"><option value="blue">🟦 زرقاء (أمانة)</option><option value="yellow">🟨 صفراء</option><option value="red">🟥 حمراء</option></select><input id="mcr-${m.id}" placeholder="السبب (اختياري)" maxlength="80" aria-label="السبب"><button class="btn sm" data-act="cardadd" data-id="${m.id}">+ بطاقة</button></div></div>
    </div>` : ""}
  </div>`;
}

// ---------------- reports ----------------
function viewReports() {
  const act = L.activeKids(S); const edit = can("plan");
  const rows = S.meetings.map((m) => {
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
async function setPoint(kid, patch) {
  const key = meetId + "|" + kid; const prev = I.pts[key] ? { ...I.pts[key] } : null;
  const row = { meeting_id: meetId, kid_id: kid, ...(prev ? {} : {}), ...patch };
  // optimistic
  const local = { ...(prev || { meeting_id: meetId, kid_id: kid, present: true, i: 0, t: 0, m: 0, s: 0, a: 0, fazaa: false, home: false }), ...patch };
  const ix = S.points.findIndex((p) => p.meeting_id === meetId && p.kid_id === kid);
  if (ix >= 0) S.points[ix] = local; else S.points.push(local);
  I = L.index(S); render();
  const ok = await guard(() => db.upsert("points", [row], "meeting_id,kid_id"));
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
    case "scrtab": ui.screenTab = b.dataset.v; return viewScreen();
    case "ltab": ui.leagueTab = b.dataset.v; return viewLeague();
    case "present": return setPoint(k, { present: !L.present(I, meetId, k) });
    case "pt": { const r = L.row(I, meetId, k) || {}; return setPoint(k, { [b.dataset.c]: r[b.dataset.c] ? 0 : 1 }); }
    case "fazaa": { const r = L.row(I, meetId, k) || {}; const car = I.kid[k].caravan_id; if (!r.fazaa && L.kidsOf(S, car).some((x) => x.id !== k && (L.row(I, meetId, x.id) || {}).fazaa)) return toast("الفزعة مرة وحدة لكل قافلة في اللقاء.", "err"); return setPoint(k, { fazaa: !r.fazaa }); }
    case "warn": { await guard(() => db.insert("deductions", [{ meeting_id: meetId, kid_id: k, value: 0, reason: "إنذار شفهي" }]), "سُجّل الإنذار"); await guard(() => reload("deductions")); return render(); }
    case "dedopen": ui.openDed = ui.openDed === k ? null : k; return render();
    case "dedadd": { const r = L.REASONS[Number(sel("dr-" + k).value)]; ui.openDed = null; await guard(() => db.insert("deductions", [{ meeting_id: meetId, kid_id: k, value: r[1], reason: r[0] }]), "سُجّل الخصم"); await guard(() => reload("deductions")); return render(); }
    case "dedundo": await guard(() => db.remove("deductions", { id }), "تم التراجع"); await guard(() => reload("deductions")); return render();
    case "tc": { const car = Number(b.dataset.car); const v = Math.max(0, (I.tc[meetId + "|" + car] || 0) + Number(b.dataset.d));
      const ix = S.team_challenge.findIndex((x) => x.meeting_id === meetId && x.caravan_id === car); const prev = ix >= 0 ? S.team_challenge[ix].points : null;
      if (ix >= 0) S.team_challenge[ix] = { ...S.team_challenge[ix], points: v }; else S.team_challenge.push({ meeting_id: meetId, caravan_id: car, points: v });
      I = L.index(S); render();
      const r = await guard(() => db.upsert("team_challenge", [{ meeting_id: meetId, caravan_id: car, points: v }], "meeting_id,caravan_id"));
      if (r === undefined) { await guard(() => reload("team_challenge")); render(); } return; }
    case "carsave": { const cid = Number(id); const patch = { name: sel("cn-" + cid).value.trim() || I.car[cid].name, color: sel("cc-" + cid).value, chant: sel("ch-" + cid).value.trim(), charter: sel("ct-" + cid).value.trim() }; await guard(() => db.update("caravans", { id: cid }, patch), "حُفظت القافلة"); await guard(() => reload("caravans")); return render(); }
    case "balance": ui.balancePlan = L.suggestBalance(S); return viewCaravans();
    case "balcancel": ui.balancePlan = null; return viewCaravans();
    case "balapply": { const plan = ui.balancePlan; ui.balancePlan = null; const ch = L.activeKids(S).filter((x) => plan[x.id] !== x.caravan_id); await guard(async () => { for (const x of ch) await db.update("kids", { id: x.id }, { caravan_id: plan[x.id] }); }, "اعتُمد التوزيع (" + ch.length + " تغيير)"); await guard(() => reload("kids")); return render(); }
    case "kidadd": { const f = sel("nk-first").value.trim(), fam = sel("nk-fam").value.trim(), car = sel("nk-car").value; if (!f) return toast("اكتب الاسم الأول.", "err"); await guard(() => db.insert("kids", [{ first_name: f, family_name: fam, caravan_id: car ? Number(car) : null }]), "أُضيف " + f); await guard(() => reload("kids")); return render(); }
    case "kidedit": ui.editKid = id || null; return viewKids();
    case "kidsave": { const f = sel("ek-first").value.trim(); if (!f) return toast("الاسم الأول مطلوب.", "err"); await guard(() => db.update("kids", { id }, { first_name: f, family_name: sel("ek-fam").value.trim(), official: sel("ek-off").checked }), "حُفظ الاسم"); ui.editKid = null; await guard(() => reload("kids")); return render(); }
    case "kidactive": { const kd = I.kid[id]; await guard(() => db.update("kids", { id }, { active: !kd.active }), kd.active ? "أُوقف" : "فُعّل"); await guard(() => reload("kids")); return render(); }
    case "badgeadd": { const ev = sel("bd-ev").value.trim(); if (!ev) return toast("اكتب الشاهد: الموقف أو الإنجاز اللي استحق عليه الشارة.", "err"); await guard(() => db.insert("badges", [{ kid_id: k, badge: sel("bd-type").value, evidence: ev, meeting_id: meetId }]), "مُنحت الشارة"); await guard(() => reload("badges")); return render(); }
    case "badgedel": if (ui.armed !== key) { ui.armed = key; b.textContent = "تأكيد؟"; setTimeout(() => (ui.armed = null), 3000); return; } await guard(() => db.remove("badges", { id }), "حُذفت"); await guard(() => reload("badges")); return render();
    case "noteadd": { const t = sel("nt-body").value.trim(); if (!t) return; await guard(() => db.insert("kid_notes", [{ kid_id: k, body: t }]), "أُضيفت الكلمة"); await guard(() => reload("kid_notes")); return render(); }
    case "notedel": if (ui.armed !== key) { ui.armed = key; b.textContent = "تأكيد؟"; setTimeout(() => (ui.armed = null), 3000); return; } await guard(() => db.remove("kid_notes", { id }), "حُذفت"); await guard(() => reload("kid_notes")); return render();
    case "print": return window.print();
    case "mopen": ui.openMatch = ui.openMatch === Number(id) ? null : Number(id); return viewLeague();
    case "msave": { const mid = Number(id); const hg = sel("mh-" + mid).value, ag = sel("ma-" + mid).value;
      const th = Number(sel("mth-" + mid).value), ta = Number(sel("mta-" + mid).value); if (th === ta) return toast("اختر قافلتين مختلفتين.", "err");
      const played = hg !== "" && ag !== "";
      const patch = { home_id: th, away_id: ta, round: Number(sel("mr-" + mid).value) || 1, meeting_id: Number(sel("mm-" + mid).value), home_goals: played ? Number(hg) : null, away_goals: played ? Number(ag) : null, played, fair_home: sel("mfh-" + mid).checked, fair_away: sel("mfa-" + mid).checked, home_keeper: sel("mkh-" + mid).value || null, away_keeper: sel("mka-" + mid).value || null, spirit_kid: sel("msp-" + mid).value || null };
      await guard(() => db.update("matches", { id: mid }, patch), "حُفظت النتيجة"); await guard(() => reload("matches")); return render(); }
    case "goaladd": { const mid = Number(id); const kid = sel("mg-" + mid).value; if (!kid) return toast("اختر اللاعب اللي سجّل.", "err"); await guard(() => db.insert("goals", [{ match_id: mid, kid_id: kid }]), "سُجّل الهدف"); await guard(() => reload("goals")); return render(); }
    case "goaldel": await guard(() => db.remove("goals", { id }), "حُذف الهدف"); await guard(() => reload("goals")); return render();
    case "cardadd": { const mid = Number(id); const kid = sel("mck-" + mid).value; if (!kid) return toast("اختر اللاعب.", "err"); await guard(() => db.insert("cards", [{ match_id: mid, kid_id: kid, color: sel("mcc-" + mid).value, reason: sel("mcr-" + mid).value.trim() }]), "سُجّلت البطاقة"); await guard(() => reload("cards")); return render(); }
    case "carddel": await guard(() => db.remove("cards", { id }), "حُذفت البطاقة"); await guard(() => reload("cards")); return render();
    case "addfinal": { if (S.matches.some((m) => m.stage === "final")) return toast("النهائي مضاف من قبل.", "err"); const st = L.standings(S); if (st.length < 4) return; const last = S.meetings[S.meetings.length - 1];
      await guard(() => db.insert("matches", [{ round: 7, stage: "final", meeting_id: last && last.id, home_id: st[0].id, away_id: st[1].id }, { round: 7, stage: "third", meeting_id: last && last.id, home_id: st[2].id, away_id: st[3].id }]), "أُضيف النهائي"); await guard(() => reload("matches")); return render(); }
    case "meetsave": { const mid = Number(id); await guard(() => db.update("meetings", { id: mid }, { theme: sel("mt-theme").value.trim(), skill: sel("mt-skill").value.trim(), diwan: sel("mt-diwan").value.trim(), observation: sel("mt-obs").value.trim(), meet_date: sel("mt-date").value }), "حُفظت بيانات اللقاء"); await guard(() => reload("meetings")); return render(); }
    case "meetadd": { const d = sel("mt-new").value; if (!d) return toast("اختر تاريخ اللقاء.", "err"); if (S.meetings.some((x) => x.meet_date === d)) return toast("فيه لقاء بنفس التاريخ.", "err");
      await guard(async () => { await db.insert("meetings", [{ meet_date: d }]); await renumber(); }, "أُضيف اللقاء"); return render(); }
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
  if (a === "meet") { meetId = Number(t.value); ui.openDed = null; return render(); }
  if (a === "kidcar") { await guard(() => db.update("kids", { id: t.dataset.id }, { caravan_id: t.value ? Number(t.value) : null }), "نُقل المغامر"); await guard(() => reload("kids")); return render(); }
  if (a === "kidpos") { await guard(() => db.update("kids", { id: t.dataset.id }, { position: t.value || null }), "حُفظ المركز"); await guard(() => reload("kids")); return; }
  if (a === "kidtrait") { await guard(() => db.update("kids", { id: t.dataset.id }, { trait: t.value || null }), "حُفظ"); await guard(() => reload("kids")); return; }
  if (a === "measure") { const v = t.value === "" ? null : Number(t.value); const m = { kid_id: t.dataset.k, test: t.dataset.t, phase: t.dataset.p };
    if (v == null) await guard(() => db.remove("measures", m), "حُذف القياس"); else await guard(() => db.upsert("measures", [{ ...m, value: v }], "kid_id,test,phase"), "حُفظ القياس");
    await guard(() => reload("measures")); return render(); }
  if (a === "roundspirit") { await guard(() => db.upsert("league_rounds", [{ round: Number(t.dataset.r), spirit_kid: t.value || null }], "round"), "حُفظ لاعب الجولة"); await guard(() => reload("league_rounds")); return render(); }
  if (a === "perm") { const acc = accounts.find((x) => x.id === t.dataset.id); const perms = { ...(acc.perms || {}), [t.dataset.p]: t.checked }; await guard(() => db.rpc("decide_account", { target: acc.id, decision: "perms", new_perms: perms }), "حُفظت الصلاحية"); await guard(loadAccounts); return; }
});

// ---------------- boot ----------------
window.addEventListener("hashchange", render);
(async function boot() {
  const type = auth.consumeHash();
  if (type) { history.replaceState(null, "", location.pathname + (type === "recovery" ? "#reset" : "#home")); }
  if (auth.session) { await guard(() => auth.loadUser()); }
  render();
})();
