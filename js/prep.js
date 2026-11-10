import { PLANS, fmt12 } from "./plans.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = Number(new URLSearchParams(location.search).get("m")) || 1;
const P = PLANS[n]; const root = document.getElementById("root");
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
if (!P) root.innerHTML = "<p>ما فيه تحضير منشور لهذا اللقاء.</p>";
else {
  const d = new Date(P.date + "T12:00:00");
  const list = (a) => (a && a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const main = P.segs.filter((s) => ["event", "league", "close"].includes(s.kind));
  document.title = `تحضير اللقاء ${n} · المغامرون`;
  root.innerHTML = `
  <header class="hd"><img src="assets/mahara.png" alt="نادي مهارة"><div><h1>تحضير اللقاء ${n} · ${esc(P.title)}</h1><p>فئة المغامرين (10–12) · نادي مهارة – حي الهجرة · ${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}</p></div></header>
  <div class="noprint"><button id="pr">طباعة / PDF</button></div>
  <div class="meta"><div><small>قيمة الأسبوع</small><b>${esc(P.value)}</b></div><div><small>مهارة الديوان</small><b>${esc(P.diwanSkill)}</b></div><div><small>محطة المهارات</small><b>${esc(P.station)}</b></div><div><small>الميدان</small><b>${esc(P.field)}</b></div></div>
  <div class="box"><h2>هدف اللقاء</h2><p>${esc(P.goal)}</p><h2>كيف تعيش الفئة القيمة</h2><p>${esc(P.live)}</p></div>
  <h2>الجدول</h2>
  <table><thead><tr><th>الوقت</th><th>الفقرة</th><th>المكان</th><th>المنفّذ</th></tr></thead><tbody>${P.segs.filter((s) => s.kind !== "prep").map((s) => `<tr><td class="t">${fmt12(s.from)}–${fmt12(s.to)}</td><td><b>${esc(s.title)}</b><br><span style="color:var(--muted)">${esc(s.aim || "")}</span></td><td>${esc(s.place)}</td><td>${esc(s.who)}</td></tr>`).join("")}</tbody></table>
  ${main.map((s) => `<div class="seg"><h3>${esc(s.title)}</h3><p class="sub">${fmt12(s.from)}–${fmt12(s.to)} · ${esc(s.place)}</p>
    ${s.rule ? `<div class="rule"><b>القاعدة المعلنة:</b> ${esc(s.rule)}${s.why ? `<br><b>السبب:</b> ${esc(s.why)}` : ""}</div>` : ""}
    ${s.levels ? `<div class="lv">${s.levels.map(([a, b]) => `<div><b>${esc(a)}:</b> ${esc(b)}</div>`).join("")}</div>` : ""}
    ${s.steps ? `<ol>${s.steps.map(([t, x]) => `<li><b>${fmt12(t)}</b> ${esc(x)}</li>`).join("")}</ol>` : ""}
    ${s.safety ? `<p><b>السلامة:</b></p>${list(s.safety)}` : ""}${s.alt ? `<p><b>البديل:</b> ${esc(s.alt)}</p>` : ""}</div>`).join("")}
  <div class="box"><h2>التكليفات</h2>${list(Object.entries(P.duties || {}).map(([c, x]) => `${c}: ${x}`))}<h2>مباريات الدوري</h2>${(P.matches || []).length ? list(P.matches.map((m) => m.join(" × "))) : "<p>مباراتان: أول مباراة لأول قافلتين انضبطتا في الجمع، والجدول يُبنى في المنصة بدون تكرار.</p>"}</div>
  <div class="box"><h2>الأدوات</h2>${list(P.tools)}<h2>دور المساعد</h2><p>${esc(P.assistant)}</p></div>
  <div class="box"><h2>سؤال التأمل</h2><p>${esc(P.reflect)}</p><h2>التحدي المنزلي</h2><p>${esc(P.home)}</p></div>
  <p class="foot">أعدّه مسؤول فئة المغامرين · نادي مهارة – حي الهجرة · جمعية أطفال طيبة</p>`;
}
const pr = document.getElementById("pr"); if (pr) pr.addEventListener("click", () => window.print());
