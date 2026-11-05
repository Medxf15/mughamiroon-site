// بطاقة القوة v4 — مكوّن واحد للطباعة والشاشة (63×88 مم)
// الطبقات: الدرجة (الشريط العلوي + الإطار + اللون) ← الرمز ← الاسم ← الفائدة ← التفصيل والمدة ومتى
import { POWER, TIER } from "./logic.js";

const BALL = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/><path d="M${cx} ${cy - r * 0.42} l${r * 0.4} ${r * 0.29} -${r * 0.15} ${r * 0.47} h-${r * 0.5} l-${r * 0.15} -${r * 0.47}z" fill="var(--ic2,#0e1633)"/>`;
const JERSEY = (x, y, s, fill = "currentColor") => `<path transform="translate(${x} ${y}) scale(${s})" d="M-22 -30 -8 -36c2 6 14 6 16 0l14 6 14 16-11 11-8-7v42h-38v-42l-8 7-11-11z" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/>`;
const PERSON = (x, y) => `<circle cx="${x}" cy="${y}" r="7.5" fill="currentColor"/><path d="M${x - 9} ${y + 42}v-24a9 9 0 0 1 18 0v24z" fill="currentColor"/>`;
const CARD = (x, y, w, h, rot, fill = "currentColor") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})" fill="${fill}"/>`;

/** رموز البطاقات: مشاهد كورة حرفية (viewBox 120) — currentColor أساسي، --ic2 تفاصيل، --ic3 إبراز */
export const PICONS = {
  kickoff: `<rect x="8" y="22" width="104" height="76" rx="6" fill="currentColor"/>
    <g fill="none" stroke="var(--ic2,#0e1633)" stroke-width="3.5" opacity=".55"><path d="M60 22v76"/><circle cx="60" cy="60" r="15"/><path d="M8 44h14v32H8M112 44H98v32h14"/></g>
    ${BALL(60, 60, 9)}<circle cx="60" cy="60" r="9" fill="none" stroke="var(--ic2,#0e1633)" stroke-width="2.5"/>
    <path d="M70 12h30" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M112 12l-13-9v18z" fill="currentColor"/>
    <path d="M50 108H20" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M8 108l13-9v18z" fill="currentColor"/>`,
  freekick: `<path d="M18 102C22 56 56 22 100 22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 10"/>
    ${PERSON(48, 64)}${PERSON(66, 64)}${PERSON(84, 64)}${BALL(98, 24, 13)}${BALL(18, 104, 10)}`,
  penalty: `<path d="M12 74V26h96v48" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M24 26v48M36 26v48M48 26v48M60 26v48M72 26v48M84 26v48M96 26v48M12 38h96M12 50h96M12 62h96" stroke="currentColor" stroke-width="1.6" opacity=".5"/>
    ${BALL(60, 98, 11)}<path d="M66 86 88 42" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 7"/><path d="M80 42h9v9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  block: `${CARD(22, 14, 54, 78, -12)}<path d="M38 34h22M38 46h16" stroke="var(--ic2,#0e1633)" stroke-width="5" stroke-linecap="round" transform="rotate(-12 49 53)" opacity=".5"/>
    <circle cx="80" cy="80" r="27" fill="#fff"/><circle cx="80" cy="80" r="22" fill="none" stroke="#e63329" stroke-width="9"/><path d="M64 96 96 64" stroke="#e63329" stroke-width="9" stroke-linecap="round"/>`,
  extra: `${JERSEY(60, 64, 1.3)}<text x="60" y="84" text-anchor="middle" font-family="Readex Pro,sans-serif" font-weight="700" font-size="34" fill="var(--ic3,#e63329)" direction="ltr">+1</text>`,
  loan: `${JERSEY(30, 74, 0.68, "var(--ic3,#58b4ff)")}${JERSEY(90, 74, 0.68)}
    <path d="M30 34c10-16 48-16 58-2" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M96 38 84 40l6-14z" fill="currentColor"/>`,
  shield: `<path d="M64 14 28 27v28c0 26 16 42 36 52 20-10 36-26 36-52V27z" fill="currentColor"/>
    <path d="M64 28 40 37v18c0 17 10 29 24 36z" fill="var(--ic2,#0e1633)" opacity=".22"/>
    ${BALL(20, 30, 12)}<path d="M8 50c4 2 8 2 12 0M14 60c4 2 8 2 12 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  golden: `${BALL(40, 70, 28)}<text x="86" y="62" text-anchor="middle" font-family="Readex Pro,sans-serif" font-weight="700" font-size="46" fill="var(--ic3,#ffd24a)" stroke="var(--ic2,#0e1633)" stroke-width="3" paint-order="stroke" direction="ltr">×2</text>`,
  // المرآة: مرآة يد فيها انعكاس بطاقة الخصم، وبطاقتكم تطلع منها
  mirror: `<ellipse cx="42" cy="48" rx="32" ry="38" fill="currentColor"/><path d="M42 86v26" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="42" cy="48" rx="24" ry="30" fill="var(--ic2,#0e1633)" opacity=".28"/>
    ${CARD(30, 30, 24, 34, -8, "currentColor")}<path d="M42 40l2.5 5.5 6 .6-4.5 4 1.3 6-5.3-3-5.3 3 1.3-6-4.5-4 6-.6z" fill="var(--ic3,#ffd24a)" transform="rotate(-8 42 47)"/>
    ${CARD(72, 44, 40, 58, 10)}<path d="M92 60l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="var(--ic3,#ffd24a)" transform="rotate(10 92 73)"/>
    <path d="M70 22c14-4 26 2 30 14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M106 44l-12-6 12-6z" fill="currentColor" transform="rotate(30 100 38)"/>`,
};

const CLS = { att: "هجوم", def: "دفاع", tac: "تكتيك" };
const CLS_IC = {
  att: '<path d="M12 4 21 15h-6v5H9v-5H3z" fill="currentColor"/>',
  def: '<path d="M12 2 4 5v6c0 6 4 9.5 8 11 4-1.5 8-5 8-11V5z" fill="currentColor"/>',
  tac: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 6l3 6-3 6-3-6z" fill="currentColor"/>',
};

/** أيقونة صغيرة للقوائم والشرائح */
export const powerIcon = (kind) => (PICONS[kind] ? `<svg class="pico" viewBox="0 0 120 120" aria-hidden="true">${PICONS[kind]}</svg>` : "");

let uid = 0;
const sparkle = (x, y, r, f) => `<path d="M${x} ${y - r}C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}Z" fill="${f}"/>`;
const rect = (inset, w, rx, stroke) => `<rect x="${inset}" y="${inset}" width="${630 - 2 * inset}" height="${880 - 2 * inset}" rx="${rx}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;

function cardBg(t) {
  const id = "pc" + ++uid;
  const rays = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, b = a + (Math.PI / 24) * 0.55, cx = 315, cy = 290, R = 760;
    return `<path d="M${cx} ${cy}L${(cx + R * Math.cos(a)).toFixed(1)} ${(cy + R * Math.sin(a)).toFixed(1)}L${(cx + R * Math.cos(b)).toFixed(1)} ${(cy + R * Math.sin(b)).toFixed(1)}Z"/>`; }).join("");
  const m = `url(#${id}m)`;
  const frame = {
    1: rect(7, 14, 24, m),
    2: rect(8, 16, 24, m) + rect(28, 4, 12, m),
    3: rect(10, 20, 24, m) + rect(32, 4, 12, m) + [[58, 58], [572, 58], [58, 822], [572, 822]].map(([x, y]) => `<path d="M${x} ${y - 14}l14 14-14 14-14-14z" fill="var(--m3)" stroke="var(--m1)" stroke-width="4"/>`).join(""),
    4: rect(14, 28, 26, m) + rect(40, 5, 12, m) + rect(50, 2, 8, "#ffd24a") + [[66, 66], [564, 66], [66, 814], [564, 814]].map(([x, y]) => sparkle(x, y, 16, "#ffd24a")).join(""),
  }[t];
  return `<svg class="pc-bg" viewBox="0 0 630 880" preserveAspectRatio="none" aria-hidden="true"><defs>
    <radialGradient id="${id}f" cx="50%" cy="34%" r="72%"><stop offset="0" stop-color="var(--f1)"/><stop offset=".45" stop-color="var(--f2)"/><stop offset="1" stop-color="var(--f3)"/></radialGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--m1)"/><stop offset=".3" stop-color="var(--m2)"/><stop offset=".48" stop-color="var(--m3)"/><stop offset=".62" stop-color="var(--m2)"/><stop offset="1" stop-color="var(--m1)"/></linearGradient>
    <clipPath id="${id}c"><path d="M0 0H630V560L0 600Z"/></clipPath></defs>
    <rect width="630" height="880" fill="var(--paper)"/>
    <g clip-path="url(#${id}c)"><rect width="630" height="620" fill="url(#${id}f)"/><g fill="var(--ray)" opacity="var(--rayo)">${rays}</g>
      ${t >= 3 ? `<g fill="#fff" opacity="${t === 4 ? 0.16 : 0.3}"><path d="M-40 140 140 -40h34L-6 140z"/><path d="M400 560 720 240h22L422 560z"/></g>` : ""}
      ${t === 4 ? sparkle(120, 170, 20, "#fff3c4") + sparkle(520, 470, 16, "#fff3c4") + sparkle(470, 140, 10, "#fff3c4") : ""}
      <circle cx="315" cy="290" r="150" fill="var(--ray)" opacity="${t === 4 ? 0.16 : 0.3}"/></g>
    ${frame}</svg>`;
}

/** بطاقة القوة كاملة. cls إضافي للحجم على الشاشة (sm / md / lg) */
export function powerCard(kind, cls = "") {
  const p = POWER[kind]; if (!p) return "";
  const t = p.tier;
  return `<div class="pc4 t${t} ${cls}" dir="rtl">${cardBg(t)}
    <div class="pc-rib"><b>${TIER[t]}</b><span class="pc-cls ${p.cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${CLS_IC[p.cls]}</svg>${CLS[p.cls]}</span></div>
    <div class="pc-hero k-${kind}"><svg class="b" viewBox="0 0 120 120" aria-hidden="true">${PICONS[kind]}</svg><svg class="f" viewBox="0 0 120 120" aria-hidden="true">${PICONS[kind]}</svg></div>
    <div class="pc-plate"></div><h3 class="pc-name">${p.name}</h3>
    <p class="pc-hit">${p.hit}</p><p class="pc-sub">${p.sub}</p>
    <div class="pc-meta"><span><small>المدة</small>${p.dur}</span><span><small>متى</small>${p.when}</span></div></div>`;
}

/** ظهر البطاقة (متماثل، يتحمّل انحراف الطباعة على الوجهين) */
export function powerBack() {
  const id = "pb" + ++uid;
  const rays = Array.from({ length: 32 }, (_, i) => { const a = (i / 32) * Math.PI * 2, b = a + (Math.PI / 32) * 0.5;
    return `<path d="M315 440L${(315 + 800 * Math.cos(a)).toFixed(1)} ${(440 + 800 * Math.sin(a)).toFixed(1)}L${(315 + 800 * Math.cos(b)).toFixed(1)} ${(440 + 800 * Math.sin(b)).toFixed(1)}Z"/>`; }).join("");
  return `<div class="pc4 back"><svg class="pc-bg" viewBox="0 0 630 880" preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="${id}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#26346e"/><stop offset="1" stop-color="#0b1129"/></radialGradient></defs>
    <rect width="630" height="880" fill="url(#${id})"/><g fill="#ffd24a" opacity=".12">${rays}</g>
    <path d="M150 640V400C150 300 230 240 315 200 400 240 480 300 480 400V640Z" fill="none" stroke="#ffd24a" stroke-width="8"/>
    <path d="M178 612V404C178 318 246 266 315 232 384 266 452 318 452 404V612Z" fill="none" stroke="#ffd24a" stroke-width="2.5" opacity=".7"/></svg>
    <div class="pb-t"><b>بطاقة قوة</b><small>المغامرون · نادي مهارة</small></div></div>`;
}

// ---------------- بطاقة اللاعب (عرض القوافل) ----------------
const ROLE = {
  leader: { t: "القائد", line: "يشاور قبل ما يقرر", ic: '<path d="M12 2l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 16.8 6.1 20l1.4-6.6-5-4.5 6.6-.7z" fill="currentColor"/>' },
  deputy: { t: "النائب", line: "ما أحد من القافلة يُترك", ic: '<path d="M12 2 4 5v6c0 6 4 9.5 8 11 4-1.5 8-5 8-11V5z" fill="currentColor"/>' },
  captain: { t: "الكابتن", line: "قائد القافلة في الملعب", ic: '<rect x="3" y="7" width="18" height="10" rx="3" fill="currentColor"/><text x="12" y="15.6" text-anchor="middle" font-size="8" font-weight="700" font-family="Readex Pro,sans-serif" fill="#000">C</text>' },
  member: { t: "مغامر", line: "انضباطي = قوة قافلتي", ic: '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z" fill="#000" opacity=".75"/>' },
};
const POS = { gk: "حارس", def: "دفاع", mid: "وسط", fwd: "هجوم" };
/** kid: {first_name, family_name, position}; role: leader|deputy|captain|member; car: {name, color} */
export function playerCard(kid, role, car) {
  const r = ROLE[role] || ROLE.member;
  return `<div class="plc r-${role}" style="--tc:${car.color}"><div class="plc-rays"></div>
    <div class="plc-rib"><span class="plc-role"><svg viewBox="0 0 24 24" aria-hidden="true">${r.ic}</svg>${r.t}</span><span class="plc-car">${car.name.replace(/[ً-ْ]/g, "")}</span></div>
    <div class="plc-mono">${(kid.first_name || "?").trim().charAt(0)}</div>
    <div class="plc-plate"><b>${kid.first_name}</b><small>${kid.family_name || ""}</small></div>
    <div class="plc-foot">${kid.position && POS[kid.position] ? `<span class="plc-pos">${POS[kid.position]}</span>` : ""}<span class="plc-line">${r.line}</span></div></div>`;
}
/** ظهر البكج قبل الفتح */
export function packBack(car, label = "؟") {
  return `<div class="plc pack" style="--tc:${car.color}"><div class="plc-rays"></div><div class="pk-in"><b>${label}</b><small>قافلة ${car.name.replace(/[ً-ْ]/g, "")}</small></div></div>`;
}
