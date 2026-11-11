// «سريع»: شاشة الميدان بيد واحدة. نقاط القوافل (إضافة وخصم) بضغطتين، ونجمة أو خصم لمغامر باسمه،
// و«ختام الليلة»: ترتيب الليلة، ترشيح الجائزة واعتمادها، وسجل الجوائز.
import * as L from "./logic.js";
import { db, ApiError } from "./api.js";

export const ADD = [1, 2, 3, 5];
export const SUB = [-1, -2, -3];
export const WHY_ADD = ["جمع سريع", "تعاون", "هدوء وإصغاء", "نظافة وترتيب", "روح رياضية", "فوز لعبة", "مبادرة"];
export const WHY_SUB = ["إزعاج", "تأخير", "مقاطعة", "عدم التزام بالتعليمات", "خشونة"];
const PRIZE_WHY = ["الأعلى نقاطًا الليلة", "الأكثر تعاونًا", "الأهدأ والأسرع في الجمع", "لعب نظيف", "أتقنوا تكليفهم"];

export function initQuick(ctx) {
  const { esc, toast } = ctx;
  const ui = { sheet: null, why: "", car: "all", q: "", prize: null };
  const $app = () => document.getElementById("app");
  const carStyle = (c) => `--tc:${esc(c ? c.color : "#6b7cff")}`;
  const sg = (n) => `<bdi dir="ltr">${n > 0 ? "+" + n : n}</bdi>`;
  const first = (r) => (Array.isArray(r) ? r[0] : r) || {};
  const errMsg = (e) => (e instanceof ApiError ? e.message : "ما انحفظ: " + (e.message || e));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function retry(fn, n = 3) { let last; for (let i = 0; i < n; i++) { try { return await fn(); } catch (e) { last = e; if (e instanceof ApiError && e.status && e.status < 500) break; await wait(1500 * (i + 1)); } } throw last; }

  // ---- نقاط القافلة: تظهر فورًا، وتنحفظ في الخلفية (تعيد المحاولة لو الشبكة ضعيفة)
  async function addPts(cid, n, why) {
    const S = ctx.S(), mid = ctx.meetId(); if (!mid || !n) return;
    const row = { meeting_id: mid, caravan_id: cid, kind: "manual", game: "لعبة", points: n, note: (why || "").trim() || null };
    const tmp = { ...row, id: "tmp" + Date.now(), created_at: new Date().toISOString(), _tmp: true };
    S.field_events.push(tmp); ctx.reindex(); ui.sheet = null; ui.why = ""; ctx.render();
    const c = ctx.I().car[cid]; const drop = () => { const ix = S.field_events.indexOf(tmp); if (ix >= 0) S.field_events.splice(ix, 1); ctx.reindex(); };
    try {
      const saved = first(await retry(() => db.insert("field_events", [row])));
      Object.assign(tmp, saved); delete tmp._tmp;
      toast(`${c ? c.name : ""} ${n > 0 ? "+" + n : n}${row.note ? " · " + row.note : ""}`, "ok", async () => { await db.remove("field_events", { id: tmp.id }); drop(); });
      ctx.render();
    } catch (e) { drop(); ctx.render(); toast(errMsg(e), "err"); }
  }
  async function delEvent(id) {
    const S = ctx.S(); const ix = S.field_events.findIndex((e) => String(e.id) === String(id)); if (ix < 0) return;
    const ev = S.field_events[ix]; if (ev._tmp) return toast("لحظة، ينحفظ الحين.", "err");
    S.field_events.splice(ix, 1); ctx.reindex(); ctx.render();
    try {
      await retry(() => db.remove("field_events", { id: ev.id }));
      const { id: _i, created_at: _c, ...rest } = ev;
      toast("انحذف", "ok", async () => { const r = first(await db.insert("field_events", [rest])); S.field_events.push(r); ctx.reindex(); });
    } catch (e) { S.field_events.push(ev); ctx.reindex(); ctx.render(); toast(errMsg(e), "err"); }
  }

  // ======== ⚡ سريع ========
  function carSheet(c, m) {
    const S = ctx.S(), I = ctx.I(); const t = L.carScore(S, I, c.id, m.id);
    const chip = (w) => `<button class="chip" data-q="why" data-w="${esc(w)}" aria-pressed="${ui.why === w}">${esc(w)}</button>`;
    return `<div class="q-sheet" data-q="close-bg"><div class="q-sh" style="${carStyle(c)}" role="dialog" aria-label="نقاط ${esc(c.name)}">
      <header><h2>${esc(c.name)}</h2><span class="q-sh-n">الليلة <b class="num">${sg(t.total)}</b></span><button class="x" data-q="close" aria-label="إغلاق">×</button></header>
      <p class="q-lb">السبب (اختياري)، ثم اضغط الرقم وتنحفظ على طول:</p>
      <div class="q-why">${WHY_ADD.map(chip).join("")}</div>
      <div class="q-why sub">${WHY_SUB.map(chip).join("")}</div>
      <input id="q-why" maxlength="60" placeholder="أو اكتب السبب بكلماتك" value="${esc(WHY_ADD.includes(ui.why) || WHY_SUB.includes(ui.why) ? "" : ui.why)}">
      <div class="q-amt add">${ADD.map((n) => `<button data-q="pts" data-car="${c.id}" data-n="${n}">${sg(n)}</button>`).join("")}</div>
      <div class="q-amt sub">${SUB.map((n) => `<button data-q="pts" data-car="${c.id}" data-n="${n}">${sg(n)}</button>`).join("")}</div>
      <div class="q-other"><label>رقم آخر <input id="q-n" type="number" inputmode="numeric" min="-50" max="100" placeholder="مثال: 7 أو -4"></label><button class="btn sm" data-q="ptsn" data-car="${c.id}">سجّل</button></div>
    </div></div>`;
  }
  function kidSheet(k, m) {
    const S = ctx.S(), I = ctx.I(); const c = I.car[k.caravan_id];
    return `<div class="q-sheet" data-q="close-bg"><div class="q-sh kid" style="${carStyle(c)}" role="dialog" aria-label="${esc(L.kidName(k))}">
      <header><h2>${esc(L.kidName(k))}</h2><span class="q-sh-n">${esc(c ? c.name : "")}</span><button class="x" data-q="close" aria-label="إغلاق">×</button></header>
      <p class="q-lb">مثل بطاقته الورقية: اضغط الخانة الفاضية = نجمة الليلة، واضغط خانة الليلة (الملوّنة) = تشيلها.</p>
      ${ctx.kidCard(k, c, m, L.teamMeet(S, I, m.id, k.caravan_id))}
      <div class="row-btns"><button class="btn" data-q="close">تم</button></div>
    </div></div>`;
  }
  function viewQuick() {
    const S = ctx.S(), I = ctx.I(); const m = I.meet[ctx.meetId()]; const ed = ctx.can("points");
    if (!m) return ($app().innerHTML = ctx.shell('<p class="empty">ما فيه لقاء. أضف لقاء من «المزيد».</p>', "quick"));
    const board = L.caravanBoard(S, I); const tot = Object.fromEntries(board.map((x) => [x.c.id, x]));
    const cars = S.caravans.map((c) => { const t = L.carScore(S, I, c.id, m.id); const all = tot[c.id];
      return `<button class="q-car" style="${carStyle(c)}" data-q="car" data-car="${c.id}" ${ed ? "" : "disabled"}><b>${esc(c.name)}</b><span class="q-car-n num">${sg(t.total)}</span><small>الليلة · الإجمالي <span class="num"><bdi dir="ltr">${all.total}</bdi></span> · #${all.rank}</small></button>`; }).join("");
    const kids = L.activeKids(S).filter((k) => k.caravan_id).sort((a, b) => (I.car[a.caravan_id].sort - I.car[b.caravan_id].sort) || a.first_name.localeCompare(b.first_name, "ar"));
    const nq = ctx.normAr(ui.q);
    const kidBtn = (k) => { const pr = L.present(I, m.id, k.id), n = L.net(I, m.id, k.id), c = I.car[k.caravan_id];
      const hide = (ui.car !== "all" && String(k.caravan_id) !== String(ui.car)) || (nq && !ctx.normAr(L.kidName(k)).includes(nq));
      return `<button class="q-kid ${pr ? "" : "abs"}" style="${carStyle(c)}" data-q="kid" data-k="${k.id}" data-n="${esc(ctx.normAr(L.kidName(k)))}" data-c="${k.caravan_id}" ${hide ? "hidden" : ""}><span>${esc(L.kidName(k))}</span>${pr ? (n ? `<b class="num">${sg(n)}</b>` : "") : "<small>غائب</small>"}</button>`; };
    const evs = (S.field_events || []).filter((e) => e.meeting_id === m.id && e.kind !== "prize" && e.points).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 8);
    const sheet = ui.sheet && ui.sheet.car ? carSheet(I.car[ui.sheet.car], m) : ui.sheet && ui.sheet.kid && I.kid[ui.sheet.kid] ? kidSheet(I.kid[ui.sheet.kid], m) : "";
    $app().innerHTML = ctx.shell(`
      ${ctx.pageHead("⚡ سريع", `اللقاء ${m.number || ""} · ${ctx.fmtDate(m.meet_date)}`, ctx.meetPicker())}
      <section class="q-cars" aria-label="نقاط القوافل">${cars}</section>
      <p class="muted small q-hint">اضغط القافلة تضيف أو تخصم. كل شي يتحدّث في لوحة الترتيب فورًا.</p>
      <section class="panel q-kids"><h3>⭐ نجمة أو خصم لمغامر</h3>
        <input id="q-search" type="search" placeholder="اكتب أول حروف الاسم…" value="${esc(ui.q)}" autocomplete="off">
        <div class="q-filter"><button class="chip" data-q="fcar" data-v="all" aria-pressed="${ui.car === "all"}">الكل</button>${S.caravans.map((c) => `<button class="chip" style="${carStyle(c)}" data-q="fcar" data-v="${c.id}" aria-pressed="${String(ui.car) === String(c.id)}">${esc(c.name)}</button>`).join("")}</div>
        <div class="q-list">${kids.map(kidBtn).join("")}</div></section>
      ${evs.length ? `<section class="panel"><h3>آخر ما سجّلته الليلة</h3><ul class="pts-list">${evs.map((e) => `<li style="${carStyle(I.car[e.caravan_id])}"><b>${esc(I.car[e.caravan_id] ? I.car[e.caravan_id].name : "")}</b><span class="num ${e.points < 0 ? "bad" : "good"}">${sg(e.points)}</span><span class="muted">${esc(e.note || "بدون سبب")}${e._tmp ? " · يحفظ…" : ""}</span>${ed ? `<button class="x" data-q="del" data-id="${e.id}" aria-label="احذف">×</button>` : ""}</li>`).join("")}</ul></section>` : ""}
      <p class="q-foot"><a class="btn" href="#closing">🌙 ختام الليلة والجائزة</a> <a class="btn ghost" href="#caravans">🏆 لوحة الترتيب</a></p>
      ${sheet}`, "quick");
  }

  // ======== 🌙 ختام الليلة ========
  function viewNight() {
    const S = ctx.S(), I = ctx.I(); const m = I.meet[ctx.meetId()]; const ed = ctx.can("points");
    if (!m) return ($app().innerHTML = ctx.shell('<p class="empty">اختر لقاء.</p>', "closing"));
    const N = L.nightOf(S, I, m.id); const P = ui.prize || {};
    const pick = P.cid || (N.suggest ? N.suggest.c.id : null); const pc = pick ? I.car[pick] : null;
    const why = P.why != null ? P.why : N.suggest && pick === N.suggest.c.id ? PRIZE_WHY[0] : "";
    let prize;
    if (N.prize) { const c = I.car[N.prize.caravan_id];
      prize = `<div class="nt-win" style="${carStyle(c)}"><span class="nt-cup">🏆</span><div><small>جائزة الليلة</small><h2>قافلة ${esc(c ? c.name : "")}</h2>${N.prize.note ? `<p>${esc(N.prize.note)}</p>` : ""}</div></div>${ed ? `<button class="btn ghost sm" data-q="pzdel">غيّر القرار</button>` : ""}`;
    } else if (!ed) prize = '<p class="muted">ما اعتُمدت الجائزة بعد.</p>';
    else prize = `<p class="nt-sug">${N.suggest ? `المرشّحة بالأرقام: <b style="${carStyle(N.suggest.c)}" class="fteam">${esc(N.suggest.c.name)}</b> (${sg(N.suggest.total)} الليلة). اعتمدها أو اختر غيرها.` : N.tie.length ? `تعادل في الصدارة بين ${N.tie.map((x) => esc(x.c.name)).join(" و")} (${sg(N.tie[0].total)}). أنت تحسمها.` : "ما فيه نقاط مسجّلة الليلة بعد. اختر القافلة بنفسك لو تبي."}</p>
        <div class="prize-pick">${S.caravans.map((c) => `<button class="ga-car sm ${pick === c.id ? "on" : ""}" style="${carStyle(c)}" data-q="pzsel" data-car="${c.id}">${esc(c.name)}</button>`).join("")}</div>
        <div class="prize-why">${PRIZE_WHY.map((w) => `<button class="chip" data-q="pzwhy" data-w="${esc(w)}" aria-pressed="${why === w}">${esc(w)}</button>`).join("")}</div>
        <input id="pz-why" maxlength="60" placeholder="السبب اللي تعلنه قدّامهم" value="${esc(why)}">
        <div class="row-btns"><button class="btn" data-q="pzsave" ${pc ? "" : "disabled"}>🏆 اعتمد${pc ? " " + esc(pc.name) : ""}</button></div>`;
    const topVal = N.vals[0] && N.vals[0].n ? N.vals[0] : null;
    const stat = (v, t) => `<div class="nt-stat"><b class="num">${v}</b><span>${t}</span></div>`;
    const evs = (S.field_events || []).filter((e) => e.meeting_id === m.id && e.kind !== "prize" && e.points).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const ms = S.matches.filter((x) => x.meeting_id === m.id && x.played);
    const log = L.prizeLog(S);
    $app().innerHTML = ctx.shell(`<a class="back" href="#quick">→ سريع</a>
      ${ctx.pageHead("🌙 ختام الليلة", `اللقاء ${m.number || ""} · ${ctx.fmtDate(m.meet_date)} · كل ليلة تُحسب بنقاطها هي.`, ctx.meetPicker())}
      <section class="panel nt-prize ${N.prize ? "has" : ""}"><h3>🏆 جائزة الأسبوع</h3>${prize}</section>
      <section class="panel"><h3>ترتيب الليلة</h3>${N.any ? ctx.boardHTML(m.id) : '<p class="muted">ما سُجّل شي الليلة بعد.</p>'}</section>
      <section class="nt-stats">${stat(`${N.presentN}`, "حاضر")}${stat(`${N.starred}/${N.presentN}`, "أخذوا نجمة الليلة")}${stat(topVal ? esc(topVal.name.split(" ")[0]) : "—", topVal ? `أكثر قيمة ظهرت (${topVal.n})` : "أكثر قيمة ظهرت")}${stat(evs.length, "إضافة وخصم منك")}</section>
      ${N.presentN - N.starred > 0 && N.any ? `<p class="muted small">${N.presentN - N.starred} حاضر ما أخذ نجمة الليلة. شوفهم في <a href="#fair">ميزان العدل</a> عشان ما ينسى أحد.</p>` : ""}
      ${evs.length ? `<details class="panel"><summary><h3>نقاطك الليلة بالتفصيل</h3></summary><ul class="pts-list">${evs.map((e) => `<li style="${carStyle(I.car[e.caravan_id])}"><b>${esc(I.car[e.caravan_id] ? I.car[e.caravan_id].name : "")}</b><span class="num ${e.points < 0 ? "bad" : "good"}">${sg(e.points)}</span><span class="muted">${esc(e.note || "بدون سبب")}</span>${ed ? `<button class="x" data-q="del" data-id="${e.id}" aria-label="احذف">×</button>` : ""}</li>`).join("")}</ul></details>` : ""}
      ${ms.length ? `<section class="panel"><h3>⚽ الدوري الليلة</h3><p>${ms.map((x) => `${esc(I.car[x.home_id].name)} <b class="num">${x.home_goals ?? 0} – ${x.away_goals ?? 0}</b> ${esc(I.car[x.away_id].name)}`).join(" · ")}</p><p class="muted small">الدوري له ترتيبه في الملعب، وما يدخل في نقاط الليلة.</p></section>` : ""}
      <section class="panel"><h3>📜 سجل الجوائز</h3>
        <div class="nt-tally">${S.caravans.map((c) => `<span style="${carStyle(c)}"><b>${esc(c.name)}</b><b class="num">${log.tally[c.id] || 0}</b> 🏆</span>`).join("")}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>اللقاء</th><th>الفائزة والسبب</th></tr></thead><tbody>${log.list.filter((x) => x.prize || x.m.meet_date <= m.meet_date).map((x) => `<tr><td>${x.m.number || ""} · ${ctx.fmtDate(x.m.meet_date)}</td><td>${x.prize && I.car[x.prize.caravan_id] ? `<span class="sw" style="${carStyle(I.car[x.prize.caravan_id])}"></span><b>${esc(I.car[x.prize.caravan_id].name)}</b>${x.prize.note ? `<br><small class="muted">${esc(x.prize.note)}</small>` : ""}` : '<span class="muted">—</span>'}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h3>قلها كذا</h3><ul class="say"><li>سؤال الأسبوع: <b>«متى حسّيت الليلة إن قافلتك تحتاجك؟»</b> واسمع 3 أولاد من قوافل مختلفة.</li><li>الجائزة: قل السبب قبل الاسم، عشان الكل يعرف وش اللي يفوز.</li><li>تحميس للخميس الجاي، ثم التحدي المنزلي وصافرة الختام.</li></ul><p><a class="btn ghost sm" href="#screen">📺 اعرض ترتيب الليلة على الشاشة</a></p></section>`, "closing");
  }

  // ---------------- events ----------------
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "q-search") { ui.q = t.value; const nq = ctx.normAr(ui.q); document.querySelectorAll(".q-kid").forEach((b) => { b.hidden = (ui.car !== "all" && b.dataset.c !== String(ui.car)) || (!!nq && !b.dataset.n.includes(nq)); }); }
    if (t.id === "q-why") ui.why = t.value;
    if (t.id === "pz-why") ui.prize = { ...(ui.prize || {}), why: t.value };
  });
  const busy = new Set();
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    const f = b.dataset.q;
    if (f === "close-bg") { if (e.target !== b) return; ui.sheet = null; return ctx.render(); }
    const key = f + JSON.stringify(b.dataset); if (busy.has(key)) return; busy.add(key); setTimeout(() => busy.delete(key), 350);
    const arm = (label) => { if (ui.armed === key) { ui.armed = null; return true; } ui.armed = key; b.textContent = label; setTimeout(() => { if (ui.armed === key) ui.armed = null; }, 3000); return false; };
    switch (f) {
      case "car": ui.sheet = { car: Number(b.dataset.car) }; ui.why = ""; return ctx.render();
      case "kid": ui.sheet = { kid: b.dataset.k }; return ctx.render();
      case "close": ui.sheet = null; return ctx.render();
      case "fcar": ui.car = b.dataset.v; return ctx.render();
      case "why": ui.why = ui.why === b.dataset.w ? "" : b.dataset.w; return ctx.render();
      case "pts": return addPts(Number(b.dataset.car), Number(b.dataset.n), ui.why);
      case "ptsn": { const v = Math.trunc(Number((document.getElementById("q-n") || {}).value)); if (!v || v < -50 || v > 100) return toast("اكتب رقم بين -50 و100.", "err"); return addPts(Number(b.dataset.car), v, ui.why); }
      case "del": if (!arm("احذف؟")) return; return delEvent(b.dataset.id);
      case "pzsel": ui.prize = { ...(ui.prize || {}), cid: Number(b.dataset.car) }; return ctx.render();
      case "pzwhy": ui.prize = { ...(ui.prize || {}), why: b.dataset.w }; return ctx.render();
      case "pzsave": { const S = ctx.S(), I = ctx.I(), mid = ctx.meetId(); const N = L.nightOf(S, I, mid); const P = ui.prize || {};
        const cid = P.cid || (N.suggest ? N.suggest.c.id : null); if (!cid || N.prize) return;
        const why = ((document.getElementById("pz-why") || {}).value || "").trim(); ui.prize = null;
        return ctx.doUndoable(`🏆 جائزة الليلة: ${I.car[cid].name}`, () => db.insert("field_events", [{ meeting_id: mid, caravan_id: cid, kind: "prize", game: "جائزة الأسبوع", points: 0, note: why || null }]), async (r) => { for (const x of [].concat(r || [])) await db.remove("field_events", { id: x.id }); }, ["field_events"]); }
      case "pzdel": { if (!arm("متأكد؟")) return; const xs = (ctx.S().field_events || []).filter((x) => x.meeting_id === ctx.meetId() && x.kind === "prize");
        return ctx.doUndoable("أُلغيت الجائزة", async () => { for (const x of xs) await db.remove("field_events", { id: x.id }); return xs; }, async (r) => { await db.insert("field_events", r.map(({ id, created_at, ...x }) => x)); }, ["field_events"]); }
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.sheet) { ui.sheet = null; ctx.render(); } });

  return { viewQuick, viewNight };
}
