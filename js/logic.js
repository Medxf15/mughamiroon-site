// Pure scoring logic: points, stars, league, awards. No DOM.
export const CATS = [
  ["i", "الالتزام", "var(--c-blue)"],
  ["t", "التعاون", "var(--c-pink)"],
  ["m", "المهارة", "var(--c-orange)"],
  ["s", "الروح الرياضية", "var(--c-green)"],
  ["a", "الأخلاق", "var(--c-violet)"],
];
export const NC = CATS.length;
export const DED_CAP = 3;
export const REASONS = [
  ["سخرية أو استهزاء بزميل", 1], ["ألفاظ غير لائقة", 1], ["عدم الالتزام بالتعليمات بعد الإنذار", 1],
  ["الخروج من المكان بدون إذن", 1], ["إتلاف أو رمي الأدوات", 1], ["عدم احترام المشرف أو الحكم", 2], ["خشونة أو إيذاء متعمد", 2],
];
export const BADGES = {
  explorer: "مستكشف", cooperative: "متعاون", maker: "صانع", leader: "قائد",
  athlete: "رياضي", reader: "قارئ", creative: "مبدع", ambassador: "سفير الحي",
};
export const TESTS = {
  speed: { name: "السرعة", unit: "ث", lowerBetter: true, how: "ذهاب وعودة 10 م مرتين" },
  agility: { name: "الرشاقة", unit: "ث", lowerBetter: true, how: "زجزاج بين 6 أقماع" },
  balance: { name: "التوازن", unit: "خطوة", lowerBetter: false, how: "المشي على شريط 4 م وكيس على الرأس" },
  accuracy: { name: "الدقة", unit: "إصابة", lowerBetter: false, how: "5 أكياس في طوق على 3 م" },
  endurance: { name: "التحمّل", unit: "مرة", lowerBetter: false, how: "قفز جانبي 30 ثانية" },
};
export const ROLES = [["leader", "القائد"], ["timer", "ضابط الوقت"], ["scribe", "الموثّق"], ["tools", "مسؤول الأدوات"], ["cheer", "المشجّع"]];
export const ROAD = ["حي الهجرة", "قُباء", "العوالي", "العقيق", "سَلْع", "الحرّة", "عَيْر", "سيد الشهداء", "قمة أُحد"];

export function index(S) {
  const I = {};
  I.kid = Object.fromEntries(S.kids.map((k) => [k.id, k]));
  I.car = Object.fromEntries(S.caravans.map((c) => [c.id, c]));
  I.meet = Object.fromEntries(S.meetings.map((m) => [m.id, m]));
  I.pts = {};
  for (const p of S.points) I.pts[p.meeting_id + "|" + p.kid_id] = p;
  I.ded = {};
  for (const d of S.deductions) (I.ded[d.meeting_id + "|" + d.kid_id] ||= []).push(d);
  I.tc = {};
  for (const t of S.team_challenge) I.tc[t.meeting_id + "|" + t.caravan_id] = t.points;
  return I;
}

export const activeKids = (S) => S.kids.filter((k) => k.active);
export const kidsOf = (S, cid) => activeKids(S).filter((k) => k.caravan_id === cid)
  .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.first_name.localeCompare(b.first_name, "ar"));
export const kidName = (k) => (k ? (k.first_name + " " + (k.family_name || "")).trim() : "—");

export function row(I, mid, kid) { return I.pts[mid + "|" + kid] || null; }
export function present(I, mid, kid) { const r = row(I, mid, kid); return r ? r.present !== false : true; }
export function earned(I, mid, kid) { const r = row(I, mid, kid); if (!r) return 0; return CATS.reduce((n, c) => n + (r[c[0]] ? 1 : 0), 0); }
export function deds(I, mid, kid) { return (I.ded[mid + "|" + kid] || []).slice().sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); }
export function minus(I, mid, kid) { return Math.min(DED_CAP, deds(I, mid, kid).reduce((n, d) => n + (d.value || 0), 0)); }
export function warned(I, mid, kid) { return deds(I, mid, kid).some((d) => d.value === 0); }
export function net(I, mid, kid) { return earned(I, mid, kid) - minus(I, mid, kid); }
/** a meeting "counts" for a kid when something was recorded for it */
export function recorded(I, mid, kid) { return !!row(I, mid, kid) || deds(I, mid, kid).length > 0; }

export function teamMeet(S, I, mid, cid) {
  const ks = kidsOf(S, cid).filter((k) => present(I, mid, k.id));
  let ready = 0, full = 0, sum = 0, fz = null;
  for (const k of ks) {
    const r = row(I, mid, k.id); if (r && r.fazaa) fz = k.id;
    const n = net(I, mid, k.id); sum += n;
    const eff = Math.min(NC, n + (r && r.fazaa ? 1 : 0));
    if (eff >= NC - 1) ready++;
    if (n >= NC) full++;
  }
  const any = ks.some((k) => earned(I, mid, k.id) > 0);
  let stars = 0;
  if (ks.length >= 2 && any) { if (full === ks.length) stars = 2; else if (ready === ks.length) stars = 1; }
  return { n: ks.length, ready, full, stars, sum, fz, ch: I.tc[mid + "|" + cid] || 0 };
}

export function standings(S) {
  const t = {};
  for (const c of S.caravans) t[c.id] = { id: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, fair: 0, pts: 0 };
  for (const m of S.matches) {
    if (!m.played || m.stage !== "league" || !t[m.home_id] || !t[m.away_id]) continue;
    const h = t[m.home_id], a = t[m.away_id], hg = m.home_goals || 0, ag = m.away_goals || 0;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; a.l++; h.pts += 3; } else if (hg < ag) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
    if (m.fair_home) { h.fair++; h.pts++; } if (m.fair_away) { a.fair++; a.pts++; }
  }
  return Object.values(t).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}
export function leaguePts(S, cid) { const s = standings(S).find((x) => x.id === cid); return s ? s.pts : 0; }
export function leaguePtsAt(S, mid, cid) {
  let p = 0;
  for (const m of S.matches) {
    if (!m.played || m.meeting_id !== mid || m.stage !== "league") continue;
    const isH = m.home_id === cid, isA = m.away_id === cid; if (!isH && !isA) continue;
    const my = isH ? m.home_goals : m.away_goals, th = isH ? m.away_goals : m.home_goals;
    p += my > th ? 3 : my === th ? 1 : 0;
    if ((isH && m.fair_home) || (isA && m.fair_away)) p++;
  }
  return p;
}

export function teamTotals(S, I, cid) {
  let stars = 0, bal = 0;
  for (const m of S.meetings) { const r = teamMeet(S, I, m.id, cid); stars += r.stars; bal += r.sum + r.ch; }
  bal += leaguePts(S, cid);
  return { stars, bal };
}
export function kidTotal(S, I, kid) { return S.meetings.reduce((n, m) => n + net(I, m.id, kid), 0); }
export function kidAttendance(S, I, kid) {
  let came = 0, total = 0;
  for (const m of S.meetings) if (recorded(I, m.id, kid)) { total++; if (present(I, m.id, kid)) came++; }
  return { came, total };
}
export function ranked(S, I, list, mid) {
  const arr = list.map((k) => ({ k, tot: kidTotal(S, I, k.id), today: mid ? net(I, mid, k.id) : 0 }));
  arr.sort((a, b) => b.tot - a.tot || b.today - a.today || a.k.first_name.localeCompare(b.k.first_name, "ar"));
  let r = 0, prev = null; arr.forEach((x, i) => { if (x.tot !== prev) { r = i + 1; prev = x.tot; } x.rank = r; });
  return arr;
}

export function scorers(S) {
  const c = {}; for (const g of S.goals) c[g.kid_id] = (c[g.kid_id] || 0) + 1;
  return Object.entries(c).map(([kid, n]) => ({ kid, n })).sort((a, b) => b.n - a.n);
}
export function cardCount(S, kid, color) { return S.cards.filter((c) => c.kid_id === kid && c.color === color).length; }
export function keepers(S) {
  const k = {};
  for (const m of S.matches) {
    if (!m.played) continue;
    for (const [kid, conceded] of [[m.home_keeper, m.away_goals || 0], [m.away_keeper, m.home_goals || 0]]) {
      if (!kid) continue; const o = (k[kid] ||= { kid, games: 0, conceded: 0, clean: 0 });
      o.games++; o.conceded += conceded; if (conceded === 0) o.clean++;
    }
  }
  return Object.values(k).map((o) => ({ ...o, avg: o.games ? o.conceded / o.games : 0 }))
    .sort((a, b) => b.clean - a.clean || a.avg - b.avg || b.games - a.games);
}
/** best player = sportsmanship, not skill */
export function spiritRace(S, I) {
  const score = {};
  const add = (kid, n, why) => { if (!kid) return; const o = (score[kid] ||= { kid, pts: 0, parts: {} }); o.pts += n; o.parts[why] = (o.parts[why] || 0) + 1; };
  for (const r of S.league_rounds) add(r.spirit_kid, 3, "round");
  for (const m of S.matches) if (m.played) add(m.spirit_kid, 2, "match");
  for (const c of S.cards) add(c.kid_id, c.color === "blue" ? 2 : c.color === "yellow" ? -1 : -3, c.color);
  for (const p of S.points) if (p.s) add(p.kid_id, 1, "s");
  return Object.values(score).sort((a, b) => b.pts - a.pts);
}

/** role rotates weekly inside the caravan so each kid tries each role */
export function roleOf(S, kid, meetingNumber) {
  const ks = kidsOf(S, kid.caravan_id); const i = ks.findIndex((k) => k.id === kid.id);
  if (i < 0) return null; return ROLES[(i + (meetingNumber || 1) - 1) % ROLES.length];
}

export const POSITIONS = { gk: "حارس", def: "دفاع", mid: "وسط", fwd: "هجوم" };
/**
 * Fair league split.
 * Rule: a fixed goalkeeper is an advantage, a bigger squad is an advantage — never both.
 *  - each team gets at most one fixed goalkeeper; teams left without one rotate the keeper
 *  - leftover players (when the count doesn't divide evenly) go to goalkeeper-less teams first,
 *    because the bigger squad is their compensation; when every team has a keeper they go anywhere
 *  - then defenders, midfielders, forwards, and unknown positions are spread so every team has the
 *    fewest possible gap in each line, the strongest gap (extra defender/forward) going to teams with a keeper
 *  - finally same family names are kept apart by swapping players of the same position
 *  - ties keep a child in his current caravan so re-running changes as little as possible
 */
export function suggestBalance(S) {
  const cars = S.caravans.slice().sort((a, b) => a.sort - b.sort).map((c) => c.id);
  const C = cars.length; if (!C) return {};
  const kids = activeKids(S).slice().sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.first_name.localeCompare(b.first_name, "ar"));
  const plan = {}; const N = kids.length;
  const gks = kids.filter((k) => k.position === "gk");
  // 1) keepers: one per team, prefer current caravan
  const keeperOf = {}; const fixedGk = gks.slice(0, C);
  for (const k of fixedGk) if (k.caravan_id && cars.includes(k.caravan_id) && !keeperOf[k.caravan_id]) { keeperOf[k.caravan_id] = k; plan[k.id] = k.caravan_id; }
  for (const k of fixedGk) if (!plan[k.id]) { const c = cars.find((x) => !keeperOf[x]); keeperOf[c] = k; plan[k.id] = c; }
  const hasGk = (c) => !!keeperOf[c];
  // 2) squad sizes: equal, remainder to keeper-less teams first
  const size = {}; const base = Math.floor(N / C); let r = N % C;
  for (const c of cars) size[c] = base;
  for (const c of cars.filter((x) => !hasGk(x))) if (r > 0) { size[c]++; r--; }
  for (const c of cars.filter(hasGk)) if (r > 0) { size[c]++; r--; }
  const count = (c) => kids.filter((k) => plan[k.id] === c).length;
  const lineCount = (c, p) => kids.filter((k) => plan[k.id] === c && (k.position || "none") === p).length;
  // 3) lines: extra keepers play as field players; spread each line
  const field = kids.filter((k) => !plan[k.id]);
  for (const p of ["def", "mid", "fwd", "gk", "none"]) {
    for (const k of field.filter((x) => (x.position || "none") === p)) {
      const open = cars.filter((c) => count(c) < size[c]);
      open.sort((a, b) => lineCount(a, p) - lineCount(b, p)
        || (p === "def" || p === "fwd" ? (hasGk(b) - hasGk(a)) : 0)
        || (size[b] - count(b)) - (size[a] - count(a))
        || (b === k.caravan_id) - (a === k.caravan_id));
      plan[k.id] = open[0] ?? cars[0];
    }
  }
  // 4) keep same family names apart: swap with a same-position player in another team
  const fam = (c, f, except) => kids.filter((k) => plan[k.id] === c && k.family_name === f && k.id !== except).length;
  for (let pass = 0; pass < 3; pass++) {
    for (const k of kids) {
      const c = plan[k.id]; if (!k.family_name || fam(c, k.family_name, k.id) === 0) continue;
      if (fixedGk.includes(k)) continue;
      const other = kids.find((o) => plan[o.id] !== c && !fixedGk.includes(o) && (o.position || "none") === (k.position || "none")
        && fam(plan[o.id], k.family_name, o.id) === 0 && fam(c, o.family_name, k.id) === 0 && o.family_name !== k.family_name);
      if (other) { const oc = plan[other.id]; plan[other.id] = c; plan[k.id] = oc; }
    }
  }
  return plan;
}
/** per-team summary used by the balance preview */
export function balanceSummary(S, plan) {
  return S.caravans.map((c) => {
    const ks = activeKids(S).filter((k) => plan[k.id] === c.id);
    const n = (p) => ks.filter((k) => (k.position || "none") === p).length;
    const gk = ks.find((k) => k.position === "gk");
    return { c, size: ks.length, gk, def: n("def"), mid: n("mid"), fwd: n("fwd"), none: n("none"), extraGk: Math.max(0, n("gk") - 1) };
  });
}

export function currentMeeting(S) {
  const today = new Date(); const iso = today.toISOString().slice(0, 10);
  const ms = S.meetings.slice().sort((a, b) => a.meet_date.localeCompare(b.meet_date));
  return ms.find((m) => m.meet_date >= iso) || ms[ms.length - 1] || null;
}

// ================= طريق القوافل =================
/** personal levels: cumulative net points, compared with yourself only (no ranking) */
export const LEVELS = [
  { min: 0, name: "رحّال", icon: "🎒" },
  { min: 10, name: "دليل", icon: "🧭" },
  { min: 20, name: "حادي", icon: "🐪" },
  { min: 32, name: "فارس الطريق", icon: "🏇" },
];
export function level(total) {
  let i = 0; for (let j = 0; j < LEVELS.length; j++) if (total >= LEVELS[j].min) i = j;
  const nx = LEVELS[i + 1] || null;
  return { i, ...LEVELS[i], next: nx, toNext: nx ? nx.min - total : 0, pct: nx ? Math.round(((total - LEVELS[i].min) / (nx.min - LEVELS[i].min)) * 100) : 100 };
}

/** power cards: every star = one draw (gold = two). Used in a league match, one per team per match. */
export const POWER = {
  golden: { name: "الهدف الذهبي", icon: "⚡", tier: 3, rule: "لمدة دقيقتين: أي هدف لكم يُحسب هدفين." },
  shield: { name: "الدرع", icon: "🛡️", tier: 3, rule: "لمدة دقيقتين: أول هدف يدخل عليكم لا يُحسب." },
  extra: { name: "اللاعب الإضافي", icon: "👟", tier: 2, rule: "تلعبون بلاعبٍ زيادة لمدة دقيقتين." },
  freekick: { name: "الركلة الحرة", icon: "🎯", tier: 2, rule: "ركلة حرة مباشرة من منتصف الملعب، مرة واحدة." },
  timeout: { name: "الوقت المستقطع", icon: "⏱️", tier: 1, rule: "توقيف المباراة دقيقة كاملة لخطة القافلة." },
  kickoff: { name: "اختيار البداية", icon: "🧭", tier: 1, rule: "تختارون جهة الملعب وضربة البداية." },
};
export const TIER = { 1: "عادية", 2: "نادرة", 3: "أسطورية" };
const WEIGHTS = [["kickoff", 20], ["timeout", 20], ["extra", 18], ["freekick", 17], ["golden", 13], ["shield", 12]];
/** r in [0,1) */
export function drawKind(r) { let x = r * 100; for (const [k, w] of WEIGHTS) { if (x < w) return k; x -= w; } return "kickoff"; }

/** slots the caravan earned in a meeting but has not drawn yet */
export function pendingDraws(S, I, mid, cid) {
  const st = teamMeet(S, I, mid, cid).stars;
  const have = (S.power_cards || []).filter((p) => p.meeting_id === mid && p.caravan_id === cid).map((p) => p.slot);
  const out = []; for (let s = 1; s <= st; s++) if (!have.includes(s)) out.push(s);
  return out;
}
export const cardsOf = (S, cid) => (S.power_cards || []).filter((p) => p.caravan_id === cid).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
export const freeCards = (S, cid) => cardsOf(S, cid).filter((p) => !p.used_match_id);
export const cardFor = (S, matchId, cid) => (S.power_cards || []).find((p) => p.used_match_id === matchId && p.caravan_id === cid) || null;

/** stations: each ROAD stop unlocks a free privilege for the next meeting */
export const PERKS = [
  null,
  { name: "هتاف الدخول", what: "تختار القافلة هتاف أو نشيد دخول اللقاء القادم." },
  { name: "أول الصف", what: "أول قافلة تتجه للوجبة في اللقاء القادم." },
  { name: "صاحبة القرار", what: "تختار لعبة الفقرة الترفيهية في اللقاء القادم." },
  { name: "شارة الكابتن", what: "قائد القافلة يلبس شارة الكابتن في مباراة الدوري القادمة." },
  { name: "المجلس", what: "تختار القافلة مكان جلستها في الديوان." },
  { name: "راية الشاشة", what: "شعار القافلة يتصدّر الشاشة طوال اللقاء القادم." },
  { name: "المهمة السرّية", what: "تتسلم القافلة مهمة خاصة من مسؤول الفئة." },
  { name: "أسطورة الطريق", what: "اسم القافلة في لوحة الشرف، وتختار جائزة اللقاء الختامي." },
];
/** station index after each meeting, and the latest station reached */
export function roadOf(S, I, cid) {
  let stars = 0; const reached = [];
  for (const m of S.meetings) {
    const before = Math.min(ROAD.length - 1, stars);
    stars += teamMeet(S, I, m.id, cid).stars;
    const after = Math.min(ROAD.length - 1, stars);
    for (let p = before + 1; p <= after; p++) reached.push({ pos: p, meeting_id: m.id });
  }
  const pos = Math.min(ROAD.length - 1, stars);
  return { pos, reached, last: reached[reached.length - 1] || null };
}

/** seals: from the start meeting on, each meeting where half the caravans earn a star opens the next seal */
export function sealState(S, I) {
  const seals = (S.seals || []).slice().sort((a, b) => a.n - b.n);
  const start = Number((S.app_settings || []).find((x) => x.key === "seal_start")?.value ?? 1);
  const cars = S.caravans;
  const need = Math.max(1, Math.ceil(cars.length / 2));
  const opened = {}; let k = 0;
  const perMeet = {};
  for (const m of S.meetings) {
    if ((m.number || 0) < start) continue;
    const got = cars.filter((c) => teamMeet(S, I, m.id, c.id).stars > 0).map((c) => c.id);
    const open = got.length >= need && k < seals.length;
    perMeet[m.id] = { seal: seals[k] || null, got, need, open };
    if (open) { opened[seals[k].n] = m.id; k++; }
  }
  return { seals, opened, perMeet, need, start, nextSeal: seals[k] || null };
}
