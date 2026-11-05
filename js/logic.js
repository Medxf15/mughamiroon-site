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
export const ROLES = [["duty", "مسؤول التكليف"], ["timer", "ضابط الوقت"], ["scribe", "الموثّق"], ["tools", "مسؤول الأدوات"], ["cheer", "المشجّع"]];
export const ROAD = ["حي الهجرة", "قُباء", "العوالي", "حرّة واقم", "سَلْع", "القبلتين", "العقيق", "جبل الرماة", "قمة أُحد"];

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
  // a meeting is "taken" once anything real was recorded in it (a mark, an absence, a deduction)
  I.started = new Set();
  for (const p of S.points) if (meaningful(p)) I.started.add(p.meeting_id);
  for (const d of S.deductions) I.started.add(d.meeting_id);
  return I;
}

export const activeKids = (S) => S.kids.filter((k) => k.active);
export const kidsOf = (S, cid) => activeKids(S).filter((k) => k.caravan_id === cid)
  .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.first_name.localeCompare(b.first_name, "ar"));
export const kidName = (k) => (k ? (k.first_name + " " + (k.family_name || "")).trim() : "—");

/** a points row that carries information (not just the default "present, nothing earned") */
export function meaningful(p) { return !!p && (p.present === false || CATS.some((c) => p[c[0]]) || !!p.fazaa || !!p.home); }
export function row(I, mid, kid) { return I.pts[mid + "|" + kid] || null; }
export function present(I, mid, kid) { const r = row(I, mid, kid); return r ? r.present !== false : true; }
/** an absent kid earns nothing that day, but his marks are kept so a mistaken "absent" can be undone */
export function earned(I, mid, kid) { const r = row(I, mid, kid); if (!r || r.present === false) return 0; return CATS.reduce((n, c) => n + (r[c[0]] ? 1 : 0), 0); }
export function deds(I, mid, kid) { return (I.ded[mid + "|" + kid] || []).slice().sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); }
export function minus(I, mid, kid) { if (!present(I, mid, kid)) return 0; return Math.min(DED_CAP, deds(I, mid, kid).reduce((n, d) => n + (d.value || 0), 0)); }
export function warned(I, mid, kid) { return deds(I, mid, kid).some((d) => d.value === 0); }
export function net(I, mid, kid) { return earned(I, mid, kid) - minus(I, mid, kid); }
/** attendance counts for a kid once the meeting was taken, unless he joined after that meeting */
export function recorded(I, mid, kid) {
  if (!I.started || !I.started.has(mid)) return false;
  if (row(I, mid, kid) || deds(I, mid, kid).length) return true;
  const k = I.kid[kid], m = I.meet[mid];
  return !(k && m && k.created_at && m.meet_date && k.created_at.slice(0, 10) > m.meet_date);
}
export const meetingTaken = (I, mid) => !!(I.started && I.started.has(mid));

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
  for (const m of S.meetings) { const r = teamMeet(S, I, m.id, cid); stars += r.stars + dutyStarAt(S, m.id, cid); bal += r.sum + r.ch; }
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
  { min: 0, name: "راكب", icon: "🎒", what: "ركب مع القافلة وبدأ الطريق" },
  { min: 6, name: "رفيق", icon: "🤝", what: "رفيق درب يُعتمد عليه" },
  { min: 12, name: "سَنَد", icon: "🛡️", what: "يسند قافلته وقت الحاجة" },
  { min: 20, name: "خبير الدرب", icon: "🧭", what: "يعرف الطريق ويدل غيره عليه" },
  { min: 28, name: "حادي القافلة", icon: "🐪", what: "صوته يحمّس القافلة ويقودها" },
  { min: 36, name: "شيخ القافلة", icon: "🏆", what: "قدوة القافلة وكبيرها في الأخلاق" },
];
export function level(total) {
  let i = 0; for (let j = 0; j < LEVELS.length; j++) if (total >= LEVELS[j].min) i = j;
  const nx = LEVELS[i + 1] || null;
  return { i, ...LEVELS[i], next: nx, toNext: nx ? nx.min - total : 0, pct: nx ? Math.round(((total - LEVELS[i].min) / (nx.min - LEVELS[i].min)) * 100) : 100 };
}

/** power cards v2: tiers like FIFA (bronze → legendary). Drawn by luck whenever the supervisor decides, then given to a caravan. */
export const POWER = {
  kickoff: { name: "اختيار البداية", icon: "🧭", svg: "compass", tier: 1, cls: "tac", hit: "البداية لكم", sub: "تختارون جهة الملعب وضربة البداية.", dur: "مرة", when: "قبل البداية", rule: "تختارون جهة الملعب وضربة البداية." },
  freekick: { name: "الركلة الحرة", icon: "🎯", svg: "target", tier: 1, cls: "att", hit: "تسديدة مباشرة من النص", sub: "ركلة حرة مباشرة على المرمى.", dur: "ركلة وحدة", when: "قبل أي شوط", rule: "ركلة حرة مباشرة من منتصف الملعب." },
  penalty: { name: "ضربة الجزاء", icon: "🥅", svg: "penalty", tier: 2, cls: "att", hit: "جزائية لكم الحين", sub: "يسددها لاعب تختارونه.", dur: "ركلة وحدة", when: "قبل أي شوط", rule: "ضربة جزاء فورية، يسددها لاعب تختارونه." },
  block: { name: "التعطيل", icon: "⛔", svg: "block", tier: 2, cls: "def", hit: "بطاقتهم تنلغي", sub: "تلعبونها لحظة ما يعلن الخصم بطاقته.", dur: "فوري", when: "ردًّا", rule: "تلغي بطاقة الخصم لحظة إعلانها." },
  extra: { name: "الفزعة الكبرى", icon: "🦸", svg: "hero", tier: 3, cls: "tac", hit: "مشرف يلعب معكم", sub: "تختارون المشرف، وينضم لقافلتكم.", dur: "دقيقتين", when: "قبل أي شوط", rule: "مشرف تختارونه يلعب معكم دقيقتين." },
  loan: { name: "استعارة لاعب", icon: "🔁", svg: "swap", tier: 3, cls: "tac", hit: "لاعب من قافلة ثانية", sub: "تختارونه، ويلعب معكم بقميصكم.", dur: "شوط كامل", when: "قبل أي شوط", rule: "لاعب من قافلة ثانية يلعب معكم شوطًا كاملًا." },
  shield: { name: "الدرع", icon: "🛡️", svg: "shield", tier: 3, cls: "def", hit: "هدفهم الأول ما ينحسب", sub: "يصد أول هدف يدخل مرماكم.", dur: "دقيقتين", when: "قبل أي شوط", rule: "دقيقتين: أول هدف عليكم ما ينحسب." },
  golden: { name: "الهدف الذهبي", icon: "⚡", svg: "bolt", tier: 4, cls: "att", hit: "هدفكم بهدفين", sub: "كل هدف تسجلونه ينحسب هدفين.", dur: "دقيقتين", when: "قبل أي شوط", rule: "دقيقتين: كل هدف لكم بهدفين." },
  mirror: { name: "المرآة", icon: "🪞", svg: "mirror", tier: 4, cls: "def", hit: "بطاقتهم صارت لكم", sub: "تلغون بطاقة الخصم وتاخذون مفعولها.", dur: "فوري", when: "ردًّا", rule: "تلغي بطاقة الخصم وتاخذون مفعولها لكم." },
};
export const TIER = { 1: "برونزية", 2: "فضية", 3: "ذهبية", 4: "أسطورية" };
export const TIER_W = { 1: 40, 2: 30, 3: 20, 4: 10 };
/** how many printed copies of each kind */
export const DECK = { kickoff: 4, freekick: 4, penalty: 3, block: 3, extra: 3, loan: 3, shield: 3, golden: 2, mirror: 2 };
/** r1 picks the tier by weight, r2 picks a kind inside it (both in [0,1)) */
export function drawCard(r1, r2) {
  let x = r1 * 100, tier = 1;
  for (const t of [1, 2, 3, 4]) { if (x < TIER_W[t]) { tier = t; break; } x -= TIER_W[t]; tier = t; }
  const ks = Object.keys(POWER).filter((k) => POWER[k].tier === tier);
  return ks[Math.min(ks.length - 1, Math.floor(r2 * ks.length))];
}
export function drawKind(r) { return drawCard(r, (r * 7919) % 1); }

/** no automatic draws any more: the supervisor decides when a caravan gets a card */
export function pendingDraws() { return []; }
export const cardUsed = (p) => !!(p.used_match_id || p.used_at);
export const cardsOf = (S, cid) => (S.power_cards || []).filter((p) => p.caravan_id === cid).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
export const freeCards = (S, cid) => cardsOf(S, cid).filter((p) => !cardUsed(p));
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
    stars += teamMeet(S, I, m.id, cid).stars + dutyStarAt(S, m.id, cid);
    const after = Math.min(ROAD.length - 1, stars);
    for (let p = before + 1; p <= after; p++) reached.push({ pos: p, meeting_id: m.id });
  }
  const pos = Math.min(ROAD.length - 1, stars);
  return { pos, reached, last: reached[reached.length - 1] || null };
}

/** seals: one sealed letter waits at each station. A caravan opens letter n when its camel reaches station n (every star = one step). No dependence on other caravans. */
export function sealState(S, I) {
  const seals = (S.seals || []).slice().sort((a, b) => a.n - b.n);
  const byCar = {}; const at = {};
  for (const c of S.caravans) {
    const rd = roadOf(S, I, c.id);
    byCar[c.id] = rd.reached.filter((x) => seals[x.pos - 1]).map((x) => ({ n: x.pos, meeting_id: x.meeting_id, seal: seals[x.pos - 1] }));
    for (const o of byCar[c.id]) (at[o.meeting_id] ||= []).push({ cid: c.id, ...o });
    byCar[c.id].next = seals[rd.pos] || null; byCar[c.id].pos = rd.pos;
  }
  return { seals, byCar, at };
}

// ================= التكليفات =================
export const DUTIES = [
  { key: "musalla", name: "حُرّاس المصلى", icon: "🕌", short: "المصلى",
    tasks: ["ترتيب المصلى قبل الأذان", "الأحذية في مكانها الصحيح ومرتبة", "تسوية الصفوف والهدوء قبل الإقامة"] },
  { key: "kalima", name: "منبر القافلة", icon: "🎙️", short: "الكلمة",
    tasks: ["واحد من القافلة يقدّم كلمة بعد الصلاة", "فائدة واحدة واضحة خلال 3 دقائق", "القافلة تساعده في التحضير ويحضرون معه"] },
  { key: "food", name: "أُمناء الزاد", icon: "🍽️", short: "الإعاشة",
    tasks: ["استلام الوجبات من المشرف", "توزيعها على الجميع بالتساوي", "إرجاع الفائض للمشرف كما هو"] },
  { key: "clean", name: "رُوّاد النظافة", icon: "✨", short: "النظافة",
    tasks: ["المكان نظيف بعد الوجبة", "النفايات في مكانها", "المكان أنظف مما كان قبل اللقاء"] },
];
/** rotation: every caravan has one duty each meeting, and tries every duty in turn */
export function dutyOf(S, m, cid) {
  if (!m) return null;
  const cars = S.caravans.slice().sort((a, b) => a.sort - b.sort);
  const ci = cars.findIndex((c) => c.id === cid); if (ci < 0) return null;
  const i = (ci + (m.number || 1) - 1) % cars.length;
  return DUTIES[i] || null;
}
export const dutyRow = (S, mid, cid) => (S.duty_log || []).find((d) => d.meeting_id === mid && d.caravan_id === cid) || null;
export const dutyMastered = (S, mid, cid) => !!(dutyRow(S, mid, cid) || {}).mastered;
export function dutyCount(S, cid, uptoMid) {
  let n = 0;
  for (const m of S.meetings) { if (dutyMastered(S, m.id, cid)) n++; if (m.id === uptoMid) break; }
  return n;
}
/** every second mastered duty = one star */
export function dutyStarAt(S, mid, cid) { return dutyMastered(S, mid, cid) && dutyCount(S, cid, mid) % 2 === 0 ? 1 : 0; }

/** kalima: the caravan picks the speaker, but nobody speaks twice before everyone in the caravan has spoken; topics never repeat */
export function speakerCounts(S, cid, exceptMid) {
  const c = {}; for (const k of kidsOf(S, cid)) c[k.id] = 0;
  for (const d of S.duty_log || []) if (d.caravan_id === cid && d.speaker_kid && d.meeting_id !== exceptMid && c[d.speaker_kid] != null) c[d.speaker_kid]++;
  return c;
}
export function canSpeak(S, cid, kid, mid) { const c = speakerCounts(S, cid, mid); const min = Math.min(...Object.values(c)); return c[kid] === min; }
export function usedTopics(S, exceptMid, exceptCid) { return new Set((S.duty_log || []).filter((d) => d.topic != null && !(d.meeting_id === exceptMid && d.caravan_id === exceptCid)).map((d) => d.topic)); }

export const TOPIC_CATS = { v: "قيم ومبادئ", m: "المدينة المنورة" };
/** c: category · t: title · s: the hook (story/idea) · q: question the speaker asks the audience */
export const TOPICS = [
  { c: "v", t: "الكذبة الصغيرة", s: "الكذبة الصغيرة مثل كرة الثلج: كل ما دحرجتها كبرت، وتحتاج كذبة ثانية تغطيها. قال ﷺ: «عليكم بالصدق، فإن الصدق يهدي إلى البر».", q: "متى كان قول الصدق صعب عليك… وكيف حسّيت بعده؟" },
  { c: "v", t: "اعترف قبل لا يكتشفونك", s: "اللاعب اللي يقول «الكورة لمست يدي» قبل ما يشوفه الحكم، يكسب احترام الملعب كله، حتى الفريق الثاني.", q: "ليش الاعتراف بالغلط يخلي الناس يثقون فيك أكثر؟" },
  { c: "v", t: "لو لقيت جوال في الملعب", s: "ما أحد شافك، وما أحد بيدري. هنا بالضبط تنعرف الأمانة. قال ﷺ: «أدِّ الأمانة إلى من ائتمنك».", q: "وش تسوي لو لقيت شي غالي وما أحد شافك؟" },
  { c: "v", t: "الأمانة مو بس فلوس", s: "السر اللي قالك إياه صاحبك أمانة، والوقت أمانة، وحتى الأدوات اللي نستلمها في النادي أمانة.", q: "عدّ ثلاث أشياء أمانة عندك الحين." },
  { c: "v", t: "الوعد دَين", s: "قال ﷺ: «آية المنافق ثلاث: إذا حدّث كذب، وإذا وعد أخلف، وإذا اؤتمن خان». يعني الصدق والوعد والأمانة كلها وحدة.", q: "آخر وعد وعدته… وفّيت فيه؟" },
  { c: "v", t: "صاحبك يا يرفعك يا ينزلك", s: "قال ﷺ: «المرء على دين خليله، فلينظر أحدكم من يُخالل». أصحابك يشكّلونك بدون ما تحس.", q: "وش الصفة اللي تبيها في صاحبك؟" },
  { c: "v", t: "الصديق وقت الضيق", s: "كثير يضحكون معك وقت الفوز، لكن الصديق الحقيقي هو اللي يوقف معك وقت الخسارة والزعل.", q: "مين وقف معك في يوم صعب؟ وهل أنت كذا مع أصحابك؟" },
  { c: "v", t: "كيف تكسب صديق جديد", s: "ابتسامة، سلام، وسؤال بسيط: «وش اسمك؟ تلعب معنا؟». قال ﷺ: «تبسّمك في وجه أخيك لك صدقة».", q: "مين الشخص اللي ما كلّمته في النادي للحين؟ كلّمه اليوم." },
  { c: "v", t: "التنمّر: لا تكون معه ولا تسكت عنه", s: "قال ﷺ: «المسلم من سلم المسلمون من لسانه ويده». السكوت عن المتنمّر يعطيه قوة.", q: "وش تسوي لو شفت أحد يضايق زميل أصغر منه؟" },
  { c: "v", t: "الضحك على الناس", s: "قال تعالى: ﴿لا يسخر قومٌ من قوم عسى أن يكونوا خيرًا منهم﴾. الضحكة اللي تجرح ما هي مزح.", q: "كيف تعرف إن مزحتك جرحت أحد؟" },
  { c: "v", t: "قل «لا» بثقة", s: "إذا أصحابك ضغطوا عليك تسوي شي غلط عشان «تنقبل»، تذكّر: اللي يحبك ما يطلب منك تخسر نفسك.", q: "جرّب: كيف تقول «لا» لصاحبك بدون ما تخسره؟" },
  { c: "v", t: "الغلط مو نهاية الدنيا", s: "قال ﷺ: «كل ابن آدم خطّاء، وخير الخطّائين التوابون». الشاطر مو اللي ما يغلط، الشاطر اللي يتعلم.", q: "غلطة غيّرتك للأحسن؟" },
  { c: "v", t: "الاعتذار شجاعة", s: "كلمة «آسف» أثقل كلمة على اللسان، وأخفها على القلب بعد ما تقولها.", q: "ليش نحس إن الاعتذار صعب؟" },
  { c: "v", t: "الجوال والألعاب: مين يتحكم في مين؟", s: "اللعبة مصممة عشان ما تتركها. القوي هو اللي يقفل الجهاز بقراره، مو لما يخلص الشحن.", q: "كم ساعة تلعب في اليوم؟ وش ممكن تسوي بنصها؟" },
  { c: "v", t: "لما تختلف مع أبوك أو أمك", s: "تقدر تقول رأيك بأدب بدون رفع صوت. قال تعالى: ﴿فلا تقل لهما أفٍّ﴾.", q: "كيف تقول رأيك المختلف لأهلك بأدب؟" },
  { c: "v", t: "أخوك أقرب صاحب", s: "الأصحاب يتغيرون مع الأيام، لكن أخوك وأختك معك طول العمر.", q: "وش شي تسويه اليوم يفرّح أخوك أو أختك؟" },
  { c: "v", t: "الكلام عن الغايب", s: "الغيبة إنك تقول عن أحد كلام صحيح لكنه يزعّله لو سمعه. صاحب الأخلاق يحمي أصحابه حتى وهم غايبين.", q: "وش تقول لو أحد بدأ يتكلم عن زميلك الغايب؟" },
  { c: "v", t: "افرح لغيرك", s: "قال ﷺ: «لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه». لما زميلك يسجّل، صفّق له من قلب.", q: "صعب تفرح لغيرك وأنت خسران؟ ليش؟" },
  { c: "v", t: "الرحمة", s: "قال ﷺ: «الراحمون يرحمهم الرحمن». والرحمة تشمل الحيوان: رجل سقى كلبًا عطشان فغفر الله له.", q: "موقف رحمة شفته أو سويته هذا الأسبوع؟" },
  { c: "v", t: "الشكر يزيد النعمة", s: "قال تعالى: ﴿لئن شكرتم لأزيدنّكم﴾. و«من لا يشكر الناس لا يشكر الله».", q: "مين تحتاج تشكره اليوم ولا شكرته؟" },
  { c: "v", t: "فوز بأخلاق وخسارة بأخلاق", s: "البطل الحقيقي يُعرف بعد صافرة النهاية: يصافح الخصم، ويشكر الحكم، ولا يلوم زملاءه.", q: "وش تقول لفريقك بعد خسارة؟" },
  { c: "v", t: "القائد يخدم", s: "النبي ﷺ حفر الخندق مع أصحابه بيده. القائد الحقيقي أول من يشتغل وآخر من يرتاح.", q: "لو كنت قائد القافلة، وش أول شي تسويه؟" },
  { c: "v", t: "يد وحدة ما تصفّق", s: "قال تعالى: ﴿وتعاونوا على البر والتقوى﴾. أقوى قافلة مو اللي فيها أقوى لاعب، اللي ما فيها أحد متروك.", q: "متى حسّيت إن فريقك يحتاجك؟" },
  { c: "v", t: "أثقل شي في الميزان", s: "قال ﷺ: «ما من شيء أثقل في الميزان من حسن الخلق». الأخلاق تبقى لما ينسون الأهداف.", q: "وش الخُلق اللي تبي الناس يتذكرونك فيه؟" },
  { c: "v", t: "الكلمة الطيبة", s: "«والكلمة الطيبة صدقة». كلمة وحدة ممكن ترفع يوم زميلك، وكلمة ممكن تخرّبه.", q: "قل لزميلك جنبك كلمة حلوة الحين." },
  { c: "v", t: "الثقة بالنفس", s: "كل متكلم شاطر كان خايف أول مرة. الثقة ما تجي قبل التجربة، تجي بعدها.", q: "وش الشي اللي تخاف تجربه؟ ومتى بتجربه؟" },
  { c: "m", t: "ليش اسمها طيبة؟", s: "النبي ﷺ قال: «إن الله تعالى سمّى المدينة طابة». كان اسمها يثرب، وصارت المدينة وطيبة وطابة.", q: "وش الأسماء الثانية للمدينة اللي تعرفها؟" },
  { c: "m", t: "أول مسجد في الإسلام", s: "مسجد قباء أول مسجد بُني لما وصل النبي ﷺ. و«من تطهّر في بيته ثم أتى مسجد قباء فصلى فيه صلاةً كان له كأجر عمرة».", q: "مين زار قباء؟ وش تعرف عنه؟" },
  { c: "m", t: "جبل يحبنا ونحبه", s: "قال ﷺ عن أُحد: «جبلٌ يحبنا ونحبه». أكبر جبال المدينة، وطوله قرابة سبعة كيلومترات.", q: "ليش تتوقع إن النبي ﷺ قال إن الجبل يحبنا؟" },
  { c: "m", t: "درس الرماة في أُحد", s: "في غزوة أُحد نزل الرماة من الجبل قبل الأمر، فتغيّرت المعركة. الطاعة والالتزام بالخطة تصنع الفرق.", q: "وش يصير للفريق لو كل لاعب لعب على كيفه؟" },
  { c: "m", t: "سيد الشهداء", s: "حمزة بن عبدالمطلب رضي الله عنه، عم النبي ﷺ، استُشهد في أُحد، وسُمي «أسد الله». وقبره عند جبل الرماة.", q: "وش الصفات اللي تعجبك في حمزة رضي الله عنه؟" },
  { c: "m", t: "مسجد القبلتين", s: "صلّى المسلمون فيه صلاة واحدة لقبلتين: بدأوها جهة بيت المقدس، ولما نزل الأمر تحوّلوا للكعبة وهم يصلّون.", q: "وش نتعلم من سرعة استجابتهم؟" },
  { c: "m", t: "خندق حول المدينة", s: "اقترح سلمان الفارسي حفر خندق، وحفره المسلمون في أيام قليلة وهم جوعانين. الفكرة الذكية والعمل الجماعي هزموا جيشًا كبيرًا.", q: "فكرة ذكية أنقذت فريقك في يوم؟" },
  { c: "m", t: "بئر رومة", s: "كان الناس يشترون الماء، فاشترى عثمان رضي الله عنه البئر وجعلها للناس مجانًا. وما زال اسمه مرتبطًا بها إلى اليوم.", q: "وش شي تقدر تخليه «وقف» يستفيد منه الكل؟" },
  { c: "m", t: "رحلة الهجرة", s: "قطع النبي ﷺ وأبو بكر رضي الله عنه أكثر من 400 كم في الحر والخطر حتى وصلوا. ونحن نعيش اليوم في المدينة اللي وصلوها.", q: "لو كنت تمشي هالمسافة، وش تحتاج معك؟" },
  { c: "m", t: "أخوك اللي ما تعرفه", s: "آخى النبي ﷺ بين المهاجرين والأنصار. عرض سعد بن الربيع على عبدالرحمن بن عوف نصف ماله، فقال: «بارك الله لك، دُلّني على السوق».", q: "مين الأكرم في القصة؟ وليش؟" },
  { c: "m", t: "الوادي المبارك", s: "وادي العقيق قال عنه ﷺ: «صلِّ في هذا الوادي المبارك». وقافلة العقيق عندنا تحمل اسمه.", q: "وش القوافل الأربع؟ ومن وين جت أسماؤها؟" },
  { c: "m", t: "تمر المدينة", s: "قال ﷺ: «من تصبّح بسبع تمرات عجوة لم يضرّه ذلك اليوم سمّ ولا سحر». والمدينة مشهورة بأنواع كثيرة من التمر.", q: "كم نوع تمر مديني تعرف؟" },
  { c: "m", t: "حرم آمن", s: "المدينة حرم: ما يُقطع شجرها ولا يُصاد صيدها. حتى الشجر والطير آمنين فيها، فكيف الناس؟", q: "وش واجبنا تجاه مدينة بهالمكانة؟" },
  { c: "m", t: "المدينة على أرض بركانية", s: "المدينة محاطة بالحرّات، وهي صخور سوداء من براكين قديمة. وقبل قرابة 800 سنة ثار بركان قريب منها ورآه الناس.", q: "شفت الصخور السوداء حول المدينة؟ وين؟" },
];

// ================= قيادة القافلة =================
export const LEAD = {
  motto: "القائد يشاور قبل ما يقرر، ويخدم قبل ما يُخدم",
  verse: "﴿وشاورهم في الأمر﴾",
  leader: ["يجمع القافلة أول ما تنضرب الصافرة", "يستلم البطاقات ويسلّمها ويرجعها في وقتها", "يتابع إتقان تكليف القافلة ويبلّغ المشرف", "يمثل القافلة في القرارات بعد ما يشاورهم"],
  deputy: ["يساند القائد في كل مهامه", "يقوم مقام القائد إذا غاب", "يتأكد إن ما أحد من القافلة متروك", "يوصل صوت القافلة للقائد"],
};
export function leaderOf(S, kid) {
  const c = S.caravans.find((x) => x.leader_kid === kid || x.deputy_kid === kid || x.captain_kid === kid);
  if (!c) return [];
  const r = []; if (c.leader_kid === kid) r.push(["leader", "🎖️", "قائد القافلة"]); if (c.deputy_kid === kid) r.push(["deputy", "🔰", "نائب القائد"]); if (c.captain_kid === kid) r.push(["captain", "⚽", "كابتن الدوري"]);
  return r;
}
