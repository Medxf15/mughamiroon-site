// ملف اللقاء + ميزان العدل + تقرير الجمعة. كلها تُحسب من بيانات المنصة، لا إدخال مكرر.
import * as L from "./logic.js";
import { db, storage } from "./api.js";
import { planFor } from "./plans.js";

const KINDS = { attendance: "تحضير مكتوب", notes: "ورقة الملاحظات", speech: "كلمة المنبر", duty: "ورقة التكليف", photo: "صورة من اللقاء", other: "أخرى" };
const EVK = { gather: "الجمع", late: "التأخر", game_perf: "أداء اللعبة", game_coop: "تعاون اللعبة", prize: "جائزة الأسبوع" };
const BUCKET = "meeting-files";
const dutyDone = (S, mid, cid) => L.dutyMastered(S, mid, cid);

/** shrink a phone photo before upload (keeps the file small, text on paper stays readable) */
async function shrink(file) {
  if (!/^image\//.test(file.type) || file.size < 900 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch (e) { return file; }
}

export function initMeetFile(ctx) {
  const { esc, fmtDate, shell, pageHead, meetPicker, can, toast, guard, reload, ui } = ctx;
  const S = () => ctx.S(), I = () => ctx.I();
  const carName = (id) => (I().car[id] ? I().car[id].name : "—");

  // ---------- data for one meeting ----------
  function collect(m) {
    const s = S(), i = I();
    const act = L.activeKids(s);
    const rec = act.filter((k) => L.recorded(i, m.id, k.id));
    const pres = rec.filter((k) => L.present(i, m.id, k.id));
    const abs = rec.filter((k) => !L.present(i, m.id, k.id));
    const full = pres.filter((k) => L.net(i, m.id, k.id) >= L.NC);
    const avg = pres.length ? pres.reduce((n, k) => n + L.net(i, m.id, k.id), 0) / pres.length : 0;
    const dedN = s.deductions.filter((d) => d.meeting_id === m.id && d.value > 0).length;
    const cars = s.caravans.map((c) => {
      const tm = L.teamMeet(s, i, m.id, c.id);
      const duty = L.dutyOf(s, m, c.id), dr = L.dutyRow(s, m.id, c.id);
      const sp = dr && dr.speaker_kid ? i.kid[dr.speaker_kid] : null;
      const topic = dr && dr.topic != null ? L.TOPICS[dr.topic] : null;
      const events = (s.field_events || []).filter((e) => e.meeting_id === m.id && e.caravan_id === c.id);
      return { c, tm, duty, dr, sp, topic, events, kids: L.kidsOf(s, c.id) };
    });
    const matches = s.matches.filter((x) => x.meeting_id === m.id);
    const badges = (s.badges || []).filter((b) => b.meeting_id === m.id);
    const files = (s.meeting_files || []).filter((f) => f.meeting_id === m.id).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    return { m, act, rec, pres, abs, full, avg, dedN, cars, matches, badges, files };
  }

  /** what is still missing before Friday's report can be closed */
  function checklist(d) {
    const { m } = d;
    const kalimaCars = d.cars.filter((x) => x.duty && x.duty.key === "kalima");
    const dutyN = d.cars.filter((x) => x.dr).length;
    const mt = d.matches.length, mp = d.matches.filter((x) => x.played).length;
    return [
      [d.rec.length > 0 && d.rec.length >= d.act.length, "الحضور مسجّل", d.rec.length + " من " + d.act.length],
      [d.pres.some((k) => L.earned(I(), m.id, k.id) > 0), "النقاط الخمس مسجّلة", d.full.length ? d.full.length + " كاملة" : ""],
      [dutyN >= d.cars.length && d.cars.length > 0, "التكليفات مقيَّمة", dutyN + " من " + d.cars.length + " قوافل"],
      [kalimaCars.length === 0 || kalimaCars.every((x) => x.sp), "متحدث المنبر مسجّل", kalimaCars.map((x) => x.sp ? "" : x.c.name).filter(Boolean).join("، ")],
      [mt === 0 || mp === mt, "مباريات الدوري مسجّلة", mt ? mp + " من " + mt : "لا مباريات"],
      [!!(m.theme && m.theme.trim()), "موضوع الأسبوع مكتوب", ""],
      [!!(m.observation && m.observation.trim()), "ملاحظات المشرف مكتوبة", ""],
      [d.files.length > 0, "ملفات اللقاء مرفوعة", d.files.length ? d.files.length + " ملف" : "اختياري"],
    ];
  }

  // ---------- texts ----------
  function fridayReport(d) {
    const { m } = d, P = planFor(m.number);
    const att = d.rec.length ? Math.round((d.pres.length / d.rec.length) * 100) : null;
    const cars = d.cars.map((x) => `- ${x.c.name}: ${x.tm.stars === 2 ? "نجمة ذهبية" : x.tm.stars === 1 ? "نجمة" : "بدون نجمة"} (جاهزون ${x.tm.ready}/${x.tm.n})${x.duty ? " · " + x.duty.name + (x.dr ? (x.dr.mastered ? " ✓" : " ✗") : " (لم يُقيَّم)") : ""}${x.sp ? " · المنبر: " + x.sp.first_name : ""}`).join("\n");
    const ms = d.matches.filter((x) => x.played).map((x) => `- ${carName(x.home_id)} ${x.home_goals} × ${x.away_goals} ${carName(x.away_id)}`).join("\n");
    const bd = d.badges.map((b) => (I().kid[b.kid_id] ? I().kid[b.kid_id].first_name : "") + " (" + (L.BADGES[b.badge] || b.badge) + ")").filter((x) => x.trim() !== "()").join("، ");
    return `التقرير الأسبوعي · فئة المغامرين · حي الهجرة
اللقاء ${m.number} · الخميس ${fmtDate(m.meet_date)}
${m.theme ? "الموضوع: " + m.theme + "\n" : ""}${m.skill ? "المهارة: " + m.skill + "\n" : ""}${m.diwan ? "الديوان: " + m.diwan + "\n" : ""}
الحضور: ${d.rec.length ? d.pres.length + " من " + d.rec.length + " (" + att + "%)" : "لم يُسجّل"}${d.abs.length ? " · الغائبون: " + d.abs.map((k) => k.first_name).join("، ") : ""}
متوسط نقاط الحاضرين: ${d.pres.length ? d.avg.toFixed(1) + " من " + L.NC : "—"}
${d.full.length ? "حصلوا على النقاط الخمس كاملة (" + d.full.length + "): " + d.full.map((k) => k.first_name).join("، ") + "\n" : ""}الخصومات: ${d.dedN}

القوافل:
${cars}
${ms ? "\nنتائج الدوري:\n" + ms + "\n" : ""}${bd ? "\nشارات اللقاء: " + bd + "\n" : ""}${m.observation ? "\nملاحظات المشرف:\n" + m.observation + "\n" : ""}${P && P.home ? "" : ""}`.replace(/\n{3,}/g, "\n\n").trim();
  }
  function parentsMsg(d) {
    const { m } = d, P = planFor(m.number);
    const home = (P && P.home) || "";
    return `السلام عليكم ورحمة الله وبركاته
أولياء أمور المغامرين الكرام 🌟

كان لقاء الخميس (اللقاء ${m.number}) جميلًا بحمد الله${m.theme ? "، وكان موضوعه «" + m.theme + "»" : ""}.${m.skill ? "\nتدرّب الأولاد في محطة المهارات على: " + m.skill + "." : ""}
${d.rec.length ? "حضر " + d.pres.length + " من " + d.rec.length + " مغامرًا، وكسبت القوافل نجومها بالتعاون والالتزام." : ""}
${home ? "\nتحدّي هذا الأسبوع للبيت 🏠\n" + home + "\n" : ""}
نشكر لكم ثقتكم، وننتظر أبناءكم الخميس القادم بإذن الله.
فئة المغامرين · نادي مهارة – حي الهجرة`.replace(/\n{3,}/g, "\n\n").trim();
  }
  const kidFull = (k, m) => `السلام عليكم ورحمة الله، ولي أمر ${k.first_name}.
نبشّركم أن ابنكم ${k.first_name} حصل في لقاء المغامرين (الخميس ${fmtDate(m.meet_date)}) على النقاط الخمس كاملة: التعاون والالتزام والأخلاق والمبادرة والإتقان. نفخر به ونشكر لكم دعمكم 🌟
فئة المغامرين · نادي مهارة`;
  const kidAbsent = (k, m) => `السلام عليكم ورحمة الله، ولي أمر ${k.first_name}.
افتقدنا ${k.first_name} في لقاء الخميس ${fmtDate(m.meet_date)}، نسأل الله أن يكون بخير. ننتظره الخميس القادم بإذن الله، وعنده مكانه وقافلته.
فئة المغامرين · نادي مهارة`;

  const copyBtn = (t, label = "نسخ") => `<button class="btn ghost sm" data-act="mfcopy" data-t="${esc(t)}">${label}</button>`;

  // ---------- views ----------
  function viewMeet() {
    const s = S(), i = I();
    const m = i.meet[ctx.meetId()];
    if (!m) return (ctx.$app().innerHTML = shell('<div class="empty">أضف لقاءً أولًا.</div>', "home"));
    const d = collect(m), edit = can("plan"), canFile = can("points");
    const ck = checklist(d), okN = ck.filter((x) => x[0]).length;
    const P = planFor(m.number);
    const dot = (ok) => `<span class="mf-ck ${ok ? "ok" : "no"}" aria-hidden="true">${ok ? "✓" : "○"}</span>`;
    const carBlock = (x) => {
      const rows = x.kids.map((k) => {
        const p = L.row(i, m.id, k.id), pr = L.present(i, m.id, k.id), rc = L.recorded(i, m.id, k.id), n = L.net(i, m.id, k.id), dd = L.deds(i, m.id, k.id);
        const marks = L.CATS.map((c) => `<td class="mf-m">${pr && p && p[c[0]] ? "●" : "·"}</td>`).join("");
        return `<tr class="${!rc ? "mf-off" : !pr ? "mf-abs" : ""}"><td>${esc(L.kidName(k))}</td><td>${!rc ? "—" : pr ? "حاضر" : "غائب"}</td>${marks}<td class="num"><b>${rc && pr ? n : "—"}</b></td><td>${dd.length ? dd.map((z) => esc(z.reason || (z.value ? "خصم" : "تنبيه"))).join("، ") : ""}${p && p.fazaa ? " فزعة" : ""}${p && p.home ? " 🏠" : ""}</td></tr>`;
      }).join("");
      const ev = x.events.length ? `<ul class="mf-ev">${x.events.map((e) => `<li>${EVK[e.kind] || e.kind}${e.game && e.game !== EVK[e.kind] ? " · " + esc(e.game) : ""}: <b class="num">${e.points > 0 ? "+" : ""}${e.points}</b>${e.note ? " · " + esc(e.note) : ""}</li>`).join("")}</ul>` : "";
      return `<details class="panel mf-car" style="--tc:${x.c.color}" ${x.kids.some((k) => L.recorded(i, m.id, k.id)) ? "open" : ""}>
        <summary><b class="mf-cn"><i class="dot" style="--c:${x.c.color}"></i>${esc(x.c.name)}</b>
          <span class="mf-sum">${x.tm.stars === 2 ? "★★" : x.tm.stars === 1 ? "★" : "—"} · جاهزون <span class="num">${x.tm.ready}/${x.tm.n}</span> · تحدٍّ <span class="num">${x.tm.ch}</span></span></summary>
        ${x.duty ? `<p class="mf-duty">${x.duty.icon} <b>${esc(x.duty.name)}</b>: ${x.dr ? (x.dr.mastered ? "أُتقن ✓" : "لم يُتقن") : "لم يُقيَّم"}${x.sp ? ` · المتحدث: <b>${esc(x.sp.first_name)}</b>` : ""}${x.topic ? ` · «${esc(x.topic.t)}»` : ""}</p>` : ""}
        <div class="tbl-wrap"><table class="tbl mf-tbl"><thead><tr><th>الاسم</th><th>الحضور</th>${L.CATS.map((c) => `<th title="${esc(c[1])}">${esc(c[1].split(" ")[0])}</th>`).join("")}<th>الصافي</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table></div>${ev}</details>`;
    };
    const filesHtml = d.files.length ? `<ul class="mf-files">${d.files.map((f) => `<li><span class="mf-k">${esc(KINDS[f.kind] || f.kind)}</span><span class="mf-n">${esc(f.name)}</span><span class="mf-b"><button class="btn ghost sm" data-act="mfview" data-id="${f.id}">فتح</button>${canFile ? `<button class="btn danger sm" data-act="mfdel" data-id="${f.id}">حذف</button>` : ""}</span></li>`).join("")}</ul>` : `<p class="muted small">ما فيه ملفات لهذا اللقاء بعد.</p>`;
    const absents = d.abs.length ? d.abs.map((k) => `<div class="mf-msg"><b>${esc(k.first_name)}</b> ${copyBtn(kidAbsent(k, m), "نسخ رسالة الغياب")}</div>`).join("") : `<p class="muted small">ما فيه غائبين مسجّلين.</p>`;
    const fulls = d.full.length ? d.full.map((k) => `<div class="mf-msg"><b>${esc(k.first_name)}</b> ${copyBtn(kidFull(k, m), "نسخ رسالة التهنئة")}</div>`).join("") : `<p class="muted small">لا أحد حصل على الخمس كاملة بعد.</p>`;
    const report = fridayReport(d), parents = parentsMsg(d);
    ctx.$app().innerHTML = shell(`
      ${pageHead("ملف اللقاء " + m.number, `الخميس ${fmtDate(m.meet_date)}${m.theme ? " · " + esc(m.theme) : ""}`, meetPicker())}
      <div class="stats">
        <div class="stat"><span>الحضور</span><b class="num">${d.rec.length ? d.pres.length + "/" + d.rec.length : "—"}</b><small>${d.abs.length ? d.abs.length + " غائب" : ""}</small></div>
        <div class="stat"><span>متوسط النقاط</span><b class="num">${d.pres.length ? d.avg.toFixed(1) : "—"}</b><small>من ${L.NC}</small></div>
        <div class="stat"><span>الخمس كاملة</span><b class="num">${d.full.length}</b><small>مغامر</small></div>
        <div class="stat"><span>نجوم القوافل</span><b class="num">${d.cars.reduce((n, x) => n + x.tm.stars, 0)}</b><small>الخصومات ${d.dedN}</small></div>
      </div>
      <section class="panel"><h3>جاهزية الإغلاق <span class="num">(${okN} من ${ck.length})</span></h3>
        <ul class="mf-list">${ck.map((x) => `<li class="${x[0] ? "ok" : ""}">${dot(x[0])}<span>${x[1]}</span><small>${esc(x[2])}</small></li>`).join("")}</ul>
        ${P ? `<p class="small"><a href="#plan/${m.number}">📋 دليل اللقاء: ${esc(P.title)}</a></p>` : ""}</section>
      <h2 class="h2 adm-h">القوافل واللاعبون</h2>
      ${d.cars.map(carBlock).join("")}
      ${d.matches.length ? `<section class="panel"><h3>مباريات هذا اللقاء</h3><ul class="mf-list">${d.matches.map((x) => `<li class="${x.played ? "ok" : ""}">${dot(x.played)}<span>${esc(carName(x.home_id))} ${x.played ? x.home_goals + " × " + x.away_goals : "×"} ${esc(carName(x.away_id))}</span><small>الجولة ${x.round}</small></li>`).join("")}</ul></section>` : ""}
      <section class="panel"><h3>ملاحظات المشرف</h3>
        ${edit ? `<textarea id="mf-obs" rows="4" maxlength="1500" placeholder="وش صار؟ موقف، ولد يحتاج متابعة، فكرة للّقاء الجاي…">${esc(m.observation || "")}</textarea><button class="btn" data-act="mfobs" data-id="${m.id}">حفظ الملاحظات</button>` : `<p>${esc(m.observation || "—")}</p>`}</section>
      <section class="panel"><h3>الملفات والصور</h3>
        <p class="muted small">ارفع هنا صورة التحضير المكتوب، ورقة الملاحظات، ورقة كلمة المنبر، وصور اللقاء. تُحفظ خاصة بالفريق فقط.</p>
        ${filesHtml}
        ${canFile ? `<div class="mf-up"><select id="mf-kind" aria-label="نوع الملف">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><input id="mf-file" type="file" accept="image/*,application/pdf" aria-label="اختر ملفًا"><button class="btn" data-act="mfup" data-id="${m.id}">رفع</button></div>` : ""}</section>
      <h2 class="h2 adm-h">تقرير الجمعة جاهز</h2>
      <section class="panel"><h3>تقريرك الأسبوعي</h3><pre class="weekly">${esc(report)}</pre>${copyBtn(report, "نسخ التقرير")}</section>
      <section class="panel"><h3>رسالة أولياء الأمور (للمجموعة)</h3><p class="muted small">بدون أسماء أطفال، تصلح للمجموعة العامة.</p><pre class="weekly">${esc(parents)}</pre>${copyBtn(parents, "نسخ الرسالة")}</section>
      <section class="panel"><h3>تهنئة فردية (الخمس كاملة)</h3><p class="muted small">رسالة لكل ولي أمر على حدة. الأرقام تبقى في المنصة الرسمية.</p>${fulls}</section>
      <section class="panel"><h3>متابعة الغياب</h3>${absents}</section>`, "meet");
  }

  // ---------- fairness ----------
  function viewFair() {
    const s = S(), i = I();
    const ms = s.meetings.filter((m) => L.meetingTaken(i, m.id)).sort((a, b) => a.meet_date.localeCompare(b.meet_date));
    const act = L.activeKids(s);
    if (!ms.length) return (ctx.$app().innerHTML = shell(`${pageHead("ميزان العدل", "من أخذ ومن فاته: النقاط، الحضور، المنبر، التكليفات.")}<div class="empty">ما فيه لقاءات مسجّلة بعد. أول ما تسجّل أول لقاء يبدأ الميزان يشتغل.</div>`, "fair"));
    const spoke = {};
    for (const d of s.duty_log || []) if (d.speaker_kid) spoke[d.speaker_kid] = (spoke[d.speaker_kid] || 0) + 1;
    const data = act.map((k) => {
      const cells = ms.map((m) => !L.recorded(i, m.id, k.id) ? null : !L.present(i, m.id, k.id) ? "a" : L.net(i, m.id, k.id));
      const seen = cells.filter((c) => c !== null);
      const came = seen.filter((c) => c !== "a");
      const st = L.starsOf(s, i, k.id);
      const flags = [];
      if (seen.length >= 2 && seen.slice(-2).every((c) => c === "a")) flags.push("غاب آخر لقاءين");
      const lastPres = came.slice(-3);
      if (lastPres.length === 3 && lastPres.every((c) => c === 0)) flags.push("ثلاثة لقاءات بلا نقطة");
      const never = L.FIVE.filter((f) => came.length >= 4 && !st[f.k]).map((f) => f.name);
      if (never.length) flags.push("لم يكسب: " + never.join("، "));
      return { k, cells, came: came.length, seen: seen.length, st, flags, spoke: spoke[k.id] || 0, total: came.reduce((n, c) => n + c, 0) };
    });
    const flagged = data.filter((x) => x.flags.length);
    const cell = (c) => c === null ? `<td class="fh fh-x">·</td>` : c === "a" ? `<td class="fh fh-a" title="غائب">غ</td>` : `<td class="fh fh-${Math.max(0, Math.min(5, c))} num">${c}</td>`;
    const carSec = s.caravans.map((c) => {
      const rows = data.filter((x) => x.k.caravan_id === c.id);
      const kalima = rows.filter((x) => x.spoke > 0).length;
      return `<details class="panel mf-car" style="--tc:${c.color}" open><summary><b class="mf-cn"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</b><span class="mf-sum">تكلّم في المنبر <span class="num">${kalima}/${rows.length}</span></span></summary>
        <div class="tbl-wrap"><table class="tbl mf-tbl"><thead><tr><th>الاسم</th>${ms.map((m) => `<th class="num">${m.number}</th>`).join("")}<th>حضور</th><th>المجموع</th><th>المنبر</th>${L.FIVE.map((f) => `<th title="${esc(f.name)}">${esc(f.name)}</th>`).join("")}</tr></thead><tbody>
        ${rows.map((x) => `<tr class="${x.flags.length ? "mf-flag" : ""}"><td>${esc(L.kidName(x.k))}</td>${x.cells.map(cell).join("")}<td class="num">${x.came}/${x.seen}</td><td class="num"><b>${x.total}</b></td><td class="num">${x.spoke}</td>${L.FIVE.map((f) => `<td class="num ${x.came >= 4 && !x.st[f.k] ? "mf-zero" : ""}">${x.st[f.k]}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
    }).join("");
    const cmp = s.caravans.map((c) => {
      const rows = data.filter((x) => x.k.caravan_id === c.id);
      const tt = L.teamTotals(s, i, c.id);
      const cnt = rows.reduce((n, x) => n + x.came, 0);
      const avg = cnt ? rows.reduce((n, x) => n + x.total, 0) / cnt : 0;
      const duties = (s.duty_log || []).filter((d) => d.caravan_id === c.id && d.mastered).length;
      return { c, n: rows.length, avg, stars: tt.stars, duties, kal: rows.filter((x) => x.spoke > 0).length };
    });
    ctx.$app().innerHTML = shell(`
      ${pageHead("ميزان العدل", `من ${ms.length} ${ms.length === 1 ? "لقاء مسجّل" : "لقاءات مسجّلة"}. الغرض أن يمر عليك كل ولد، لا أن يلمع الأقوياء فقط.`)}
      <section class="panel"><h3>يحتاجون التفاتة منك <span class="num">(${flagged.length})</span></h3>
        ${flagged.length ? `<ul class="mf-list">${flagged.map((x) => `<li><span class="mf-cn"><i class="dot" style="--c:${(i.car[x.k.caravan_id] || {}).color || "#999"}"></i>${esc(L.kidName(x.k))}</span><small>${x.flags.map(esc).join(" · ")}</small></li>`).join("")}</ul>` : `<p class="muted">ما فيه أحد عليه علامة الحين، ممتاز.</p>`}
        <p class="muted small">العلامات: غاب آخر لقاءين، أو ثلاثة لقاءات بلا نقطة، أو قيمة ما كسبها أبدًا بعد أربعة لقاءات حضرها.</p></section>
      <section class="panel"><h3>القوافل جنبًا إلى جنب</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>القافلة</th><th>الأعضاء</th><th>معدل الصافي لكل حضور</th><th>النجوم</th><th>تكاليف مُتقنة</th><th>تكلّموا في المنبر</th></tr></thead><tbody>
        ${cmp.map((x) => `<tr style="--tc:${x.c.color}"><td><i class="dot" style="--c:${x.c.color}"></i> ${esc(x.c.name)}</td><td class="num">${x.n}</td><td class="num">${x.avg.toFixed(2)}</td><td class="num">${x.stars}</td><td class="num">${x.duties}</td><td class="num">${x.kal}/${x.n}</td></tr>`).join("")}</tbody></table></div></section>
      <h2 class="h2 adm-h">كل مغامر في كل لقاء</h2>
      <p class="muted small">الرقم هو الصافي من ${L.NC}. غ = غائب. · = لم يُسجَّل. القيم الخمس: عدد اللقاءات اللي كسبها فيها.</p>
      ${carSec}`, "fair");
  }

  // ---------- actions ----------
  async function onClick(a, b, key) {
    const id = b.dataset.id;
    switch (a) {
      case "mfcopy": { const t = b.dataset.t || ""; try { await navigator.clipboard.writeText(t); toast("نُسخ"); } catch (e) { toast("ما قدرت أنسخ تلقائيًا، حدّد النص وانسخه يدويًا.", "err"); } return true; }
      case "mfobs": { const el = document.getElementById("mf-obs"); if (!el) return true;
        await guard(() => db.update("meetings", { id }, { observation: el.value.trim() }), "حُفظت الملاحظات"); await guard(() => reload("meetings")); ctx.render(); return true; }
      case "mfup": { const inp = document.getElementById("mf-file"), kind = document.getElementById("mf-kind").value;
        const f = inp && inp.files && inp.files[0]; if (!f) { toast("اختر ملفًا أولًا.", "err"); return true; }
        if (!/^(image\/|application\/pdf)/.test(f.type)) { toast("الصور وPDF فقط.", "err"); return true; }
        b.disabled = true; b.textContent = "جاري الرفع…";
        try {
          const blob = await shrink(f);
          if (blob.size > 9.5 * 1024 * 1024) { toast("الملف كبير (أكثر من 9 ميجا). صغّره وحاول.", "err"); return true; }
          const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
          const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const ok = await guard(() => storage.upload(BUCKET, path, blob, "ما انرفع الملف"));
          if (ok) {
            const row = await guard(() => db.insert("meeting_files", [{ meeting_id: Number(id), kind, name: f.name.slice(0, 120), path, mime: blob.type, size: blob.size }]));
            if (row === undefined) await storage.remove(BUCKET, path).catch(() => {});
            else { toast("رُفع الملف"); await guard(() => reload("meeting_files")); }
          }
        } finally { b.disabled = false; ctx.render(); }
        return true; }
      case "mfview": { const f = (S().meeting_files || []).find((x) => x.id === id); if (!f) return true;
        const w = window.open("about:blank", "_blank");
        const u = await guard(() => storage.signedUrl(BUCKET, f.path, 300));
        if (u && w) w.location = u; else if (w) w.close();
        return true; }
      case "mfdel": { if (ui.armed !== key) { ui.armed = key; b.textContent = "تأكيد الحذف؟"; setTimeout(() => (ui.armed = null), 3000); return true; }
        const f = (S().meeting_files || []).find((x) => x.id === id); if (!f) return true;
        await guard(() => storage.remove(BUCKET, f.path));
        await guard(() => db.remove("meeting_files", { id }), "حُذف الملف"); await guard(() => reload("meeting_files")); ctx.render(); return true; }
    }
    return false;
  }
  return { viewMeet, viewFair, onClick, collect, fridayReport };
}
