// «طريق الحادي — الحلقة صفر»: every frame is a pure function of time, so any moment can be drawn as a still.
export const W = 1920, H = 1080;
export const CARAVANS = [
  { name: "أُحد", color: "#ef8a33" },
  { name: "القبلتين", color: "#1fa865" },
  { name: "قُباء", color: "#0a63e6" },
  { name: "العقيق", color: "#c0262e" },
];
const ROAD = ["حي الهجرة", "قُباء", "العوالي", "حرّة واقم", "سَلْع", "القبلتين", "العقيق", "جبل الرماة", "قمة أُحد"];
const LIGHTS = [["الالتزام", "#2f7bff"], ["التعاون", "#e7297a"], ["المهارة", "#ef8a33"], ["الروح الرياضية", "#1fa865"], ["الأخلاق", "#8a5cf0"]];
const FONT = '"Readex Pro","IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif';
const INK = "#0a0f2c", GLOW = "#ffcf6b";

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const span = (t, a, b) => clamp((t - a) / (b - a));
const fadeIO = (t, a, b, f = 0.6) => Math.min(span(t, a, a + f), 1 - span(t, b - f, b));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(7); const STARS = Array.from({ length: 220 }, () => [R() * W, R() * H * 0.62, R() * 1.6 + 0.3, R()]);

function sky(ctx, top = "#070b22", mid = "#1b2667", hz = "#e9874a", hzAlpha = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(0.78, mixHex(mid, hz, 0.55 * hzAlpha)); g.addColorStop(1, mixHex(mid, hz, 0.9 * hzAlpha));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function stars(ctx, t, a = 1) {
  ctx.save(); for (const [x, y, r, p] of STARS) { ctx.globalAlpha = a * (0.35 + 0.5 * Math.abs(Math.sin(t * 0.7 + p * 9))) * (1 - y / (H * 0.7)); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); } ctx.restore();
}
function mixHex(a, b, k) { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, "0")).join(""); }
function dunes(ctx, base, amp, off, color, freq = 1) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) { const u = (x + off) / W; ctx.lineTo(x, base - amp * (0.55 * Math.sin(u * 5.1 * freq) + 0.3 * Math.sin(u * 11.3 * freq + 1.7) + 0.15 * Math.sin(u * 23 * freq + 0.4))); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
/** Uhud-like long ridge */
function ridge(ctx, base, color, scale = 1, shift = 0) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-400, H);
  const pts = [[0, 0.1], [0.08, 0.25], [0.16, 0.55], [0.22, 0.48], [0.3, 0.8], [0.36, 0.7], [0.44, 1], [0.5, 0.86], [0.58, 0.95], [0.66, 0.62], [0.74, 0.7], [0.82, 0.4], [0.9, 0.3], [1, 0.12]];
  ctx.lineTo(-400, base - 0.1 * 260 * scale);
  for (const [u, v] of pts) ctx.lineTo(u * W + shift, base - v * 260 * scale);
  ctx.lineTo(W + 400, base - 0.12 * 260 * scale); ctx.lineTo(W + 400, H); ctx.closePath(); ctx.fill();
}
// camel facing right, feet at y=160 in a 200-wide box
const CAMEL = new Path2D("M30 70 C40 30 90 8 110 45 C120 55 130 50 140 40 C150 25 160 14 176 17 L190 24 L188 33 C176 33 166 35 159 46 C151 61 146 76 141 86 L139 160 L131 160 L128 100 L120 100 L117 160 L109 160 L106 98 L62 98 L58 160 L50 160 L47 100 L41 100 L38 160 L30 160 L27 96 C18 90 16 80 30 70 Z M27 80 C18 92 14 104 16 118 L20 118 C20 104 23 94 30 86 Z");
const RIDER = new Path2D("M70 26 a9 9 0 1 1 18 0 a9 9 0 1 1 -18 0 Z M66 22 C70 10 88 10 92 22 L92 26 L66 26 Z M68 36 L90 36 L96 62 L62 62 Z");
function camel(ctx, x, y, s, t = 0, rider = true, flip = true, legs = true) {
  ctx.save(); ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.ellipse(x, y + 2, 85 * s, 9 * s, 0, 0, 7); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(x, y + Math.sin(t * 5.2) * 2.5 * s); ctx.scale(flip ? -s : s, s); ctx.translate(-100, -160);
  ctx.fill(CAMEL); if (rider) ctx.fill(RIDER); ctx.restore();
}
/** man seen from behind: shemagh, thobe with a hem that moves in the wind, staff; rim = backlight glow */
function hadi(ctx, x, y, s, t = 0, color = INK, cloth = 1, rim = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const sway = Math.sin(t * 1.3) * 3, fl = Math.sin(t * 3.1) * 6;
  const body = new Path2D(); body.moveTo(-60, 0); body.quadraticCurveTo(-60 + sway, -150, -66, -250); body.quadraticCurveTo(-70, -286, -30, -294); body.lineTo(30, -294); body.quadraticCurveTo(70, -286, 66, -250); body.quadraticCurveTo(60 + sway, -150, 64 + fl, 0);
  body.lineTo(40, 6); body.lineTo(10 + fl * 0.5, 0); body.lineTo(-20, 7); body.closePath();
  const head = new Path2D(); head.ellipse(0, -330, 31, 34, 0, 0, 7);
  const sh = new Path2D(); // ghutra seen from behind: over the head, falling to a point down the back
  sh.moveTo(-36, -334); sh.quadraticCurveTo(-38, -372, 0, -374); sh.quadraticCurveTo(38, -372, 36, -334); sh.lineTo(52 + fl * 0.5, -262); sh.quadraticCurveTo(30, -230, 2 + fl * 0.4, -196); sh.quadraticCurveTo(-28, -232, -50 + fl * 0.3, -262); sh.closePath();
  if (rim > 0) { ctx.save(); ctx.shadowColor = `rgba(255,205,130,${rim})`; ctx.shadowBlur = 40; ctx.fillStyle = color; ctx.fill(body); ctx.fill(head); if (cloth > 0) ctx.fill(sh); ctx.restore(); }
  ctx.fillStyle = color; ctx.fill(body); ctx.fill(head);
  if (cloth > 0) { ctx.save(); ctx.globalAlpha = cloth; ctx.fill(sh); ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, -357, 33, 7, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -349, 34, 6, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  ctx.fillRect(74, -340, 7, 340); ctx.restore();
}
function boy(ctx, x, y, s, color = INK, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-40, -96); ctx.quadraticCurveTo(-52, -150, -50, -178); ctx.quadraticCurveTo(-42, -204, -12, -210); ctx.lineTo(14, -210); ctx.quadraticCurveTo(44, -204, 50, -176); ctx.quadraticCurveTo(54, -150, 42, -96); ctx.lineTo(52, 4); ctx.lineTo(10, -2); ctx.lineTo(-20, 5); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(-48, -176); ctx.rotate(0.12); ctx.fillRect(-9, 0, 17, 112); ctx.restore();   // left arm
  ctx.save(); ctx.translate(48, -176); ctx.rotate(-0.55); ctx.fillRect(-8, 0, 17, 92); ctx.restore();   // right arm raised
  ctx.beginPath(); ctx.ellipse(0, -244, 25, 29, 0, 0, 7); ctx.fill(); ctx.fillRect(-9, -222, 18, 14);
  ctx.beginPath(); ctx.moveTo(-26, -252); ctx.quadraticCurveTo(-24, -282, 2, -280); ctx.quadraticCurveTo(28, -280, 26, -250); ctx.quadraticCurveTo(14, -262, -26, -252); ctx.fill(); // hair
  ctx.beginPath(); ctx.arc(-92, -16, 22, 0, 7); ctx.fill();  // ball at his foot
  ctx.restore();
  lantern(ctx, x + 108 * s, y - 108 * s, 20 * s, 5, null, 1.2, t);
}
function lantern(ctx, x, y, r, level = 5, colors = null, glow = 1, t = 0) {
  ctx.save(); const fl = 1 + 0.06 * Math.sin(t * 13 + x) + 0.04 * Math.sin(t * 29 + y); const lv = clamp(level / 5);
  if (glow > 0) { ctx.globalCompositeOperation = "lighter";
    let g = ctx.createRadialGradient(x, y, 0, x, y, r * 5 * fl); g.addColorStop(0, `rgba(255,190,90,${0.38 * glow * lv})`); g.addColorStop(1, "rgba(255,170,70,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5 * fl, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, `rgba(255,250,225,${0.9 * glow * lv})`); g.addColorStop(1, "rgba(255,220,150,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "source-over"; }
  ctx.fillStyle = mixHex("#3a2a10", "#ffd98a", lv); ctx.beginPath(); ctx.ellipse(x, y, r * 0.75, r, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = r * 0.16; ctx.stroke(); ctx.fillStyle = INK; ctx.fillRect(x - r * 0.5, y - r * 1.15, r, r * 0.25); ctx.fillRect(x - r * 0.4, y + r * 0.92, r * 0.8, r * 0.22);
  ctx.restore();
}
function fog(ctx, y, h, a = 0.25, t = 0) { const g = ctx.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, "rgba(120,140,220,0)"); g.addColorStop(0.5, `rgba(120,140,220,${a})`); g.addColorStop(1, "rgba(120,140,220,0)"); ctx.fillStyle = g; ctx.fillRect(0, y - h, W, h * 2); }
function lightning(ctx, x, y, h, color = "#fff2b0") { ctx.save(); ctx.translate(x, y); ctx.scale(h / 100, h / 100); ctx.fillStyle = color; ctx.shadowColor = "#ffd36b"; ctx.shadowBlur = 30; ctx.beginPath(); ctx.moveTo(12, -50); ctx.lineTo(-22, 6); ctx.lineTo(-2, 6); ctx.lineTo(-14, 50); ctx.lineTo(24, -10); ctx.lineTo(3, -10); ctx.closePath(); ctx.fill(); ctx.restore(); }
function text(ctx, str, x, y, size, opts = {}) {
  const { color = "#fff", weight = 700, alpha = 1, glow = 0.6, align = "center", font = FONT } = opts;
  if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.direction = "rtl";
  if (glow) { ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = size * 0.4 * glow; }
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
/** subtitle band in the lower third */
function caption(ctx, str, t, a, b, y = H * 0.84, size = 66) { const k = fadeIO(t, a, b, 0.5); if (k <= 0) return; text(ctx, str, W / 2, y + (1 - k) * 12, size, { alpha: k }); }
function grain(ctx, t, a = 0.05) { const r = rng(Math.floor(t * 24) + 3); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; for (let i = 0; i < 900; i++) ctx.fillRect(r() * W, r() * H, 1.5, 1.5); ctx.restore(); }
function vignette(ctx, a = 0.55) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function waxSeal(ctx, x, y, r, crack = 0, shake = 0, t = 0) {
  ctx.save(); ctx.translate(x + Math.sin(t * 60) * shake * 6, y + Math.cos(t * 47) * shake * 4);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, "#e05252"); g.addColorStop(0.6, "#9a1d28"); g.addColorStop(1, "#5a0d16");
  ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const rr = r * (1 + 0.05 * Math.sin(i * 2.7) + 0.03 * Math.sin(i * 7.1)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill();
  ctx.strokeStyle = "rgba(255,210,190,.35)"; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 7); ctx.stroke();
  ctx.fillStyle = "rgba(60,5,12,.55)"; ctx.save(); ctx.scale(r / 150, r / 150); ctx.translate(-75, -90); ctx.scale(0.75, 0.75); ctx.fill(CAMEL); ctx.restore();
  if (crack > 0) { ctx.strokeStyle = `rgba(255,220,150,${crack})`; ctx.lineWidth = r * 0.03; ctx.shadowColor = GLOW; ctx.shadowBlur = 30 * crack;
    const cr = rng(11); for (let k = 0; k < 5; k++) { ctx.beginPath(); let px = 0, py = 0; ctx.moveTo(px, py); const ang = cr() * 7; for (let s = 0; s < 5 * crack; s++) { px += Math.cos(ang + (cr() - 0.5)) * r * 0.22; py += Math.sin(ang + (cr() - 0.5)) * r * 0.22; ctx.lineTo(px, py); } ctx.stroke(); } }
  ctx.restore();
}
function powerCard(ctx, x, y, w, flip, t) {
  // flip: 0 = back, 1 = face. width w, ratio 63:88
  const h = w * 88 / 63; const k = Math.cos(Math.PI * (1 - clamp(flip))); const sx = Math.abs(k); const face = k > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(sx, 0.02), 1);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (face) { g.addColorStop(0, "#a8700f"); g.addColorStop(1, "#3a1d52"); } else { g.addColorStop(0, "#27378a"); g.addColorStop(1, "#0f1540"); }
  ctx.shadowColor = face ? "rgba(255,200,80,.7)" : "rgba(0,0,0,.6)"; ctx.shadowBlur = face ? 60 : 30; ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.07); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = face ? "#ffd36b" : "#6b7cff"; ctx.lineWidth = w * 0.02; roundRect(ctx, -w / 2 + w * 0.05, -h / 2 + w * 0.05, w * 0.9, h - w * 0.1, w * 0.05); ctx.stroke();
  if (face) { ctx.fillStyle = "rgba(255,211,107,.18)"; ctx.beginPath(); ctx.arc(0, -h * 0.12, w * 0.3, 0, 7); ctx.fill(); lightning(ctx, 0, -h * 0.12, w * 0.42); text(ctx, "الهدف الذهبي", 0, h * 0.17, w * 0.13); text(ctx, "هدفكم بهدفين", 0, h * 0.32, w * 0.1, { weight: 600, color: "#ffe7a8", glow: 0 }); }
  else { ctx.save(); ctx.globalAlpha = 0.5; waxSeal(ctx, 0, -h * 0.05, w * 0.22, 0, 0, t); ctx.restore(); text(ctx, "؟", 0, h * 0.26, w * 0.2, { color: "#9fb0ff", glow: 0 }); }
  ctx.restore();
}

// ---------- storm particles (stateless) ----------
const PN = 1400; const PR = rng(21);
const PARTS = Array.from({ length: PN }, (_, i) => ({ a: PR() * 7, r: PR(), sp: 0.6 + PR() * 1.4, ph: PR() * 7, tx: (i / PN) * W * 0.9 + W * 0.05, ty: H * 0.62 + Math.sin(i * 0.37) * 14 + (PR() - 0.5) * 22, lamp: i % 70 === 0 }));
function storm(ctx, t, order) {
  for (const p of PARTS) {
    const cx = W / 2 + Math.cos(p.a + t * p.sp) * (W * 0.55) * p.r + Math.sin(t * 2 + p.ph) * 80;
    const cy = H / 2 + Math.sin(p.a * 1.3 + t * p.sp * 1.2) * (H * 0.5) * p.r + Math.cos(t * 1.7 + p.ph) * 60;
    const x = lerp(cx, p.tx - (t * 40) % 120, order), y = lerp(cy, p.ty, order);
    if (p.lamp) { lantern(ctx, x, y, 9 + 5 * (1 - order), 5 - 3 * (1 - order), null, 0.8, t); continue; }
    ctx.fillStyle = `rgba(${235 - 40 * order},${195 - 20 * order},${145},${0.45 + 0.35 * order})`;
    if (order < 0.5) { const vx = -Math.sin(p.a + t * p.sp) * 26 * (1 - order * 2), vy = Math.cos(p.a * 1.3 + t * p.sp * 1.2) * 14 * (1 - order * 2); ctx.save(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx, y - vy); ctx.stroke(); ctx.restore(); }
    else ctx.fillRect(x, y, 2.4, 2.4);
  }
}

// ---------- scenes ----------
// each: [start, end, title, draw(ctx, t), vo]
export const SCENES = [
  { a: 0, b: 5, title: "وسط العاصفة", key: 3.6, vo: "(ريح عالية… صوت ينادي) «وين راح؟!»", draw(ctx, t) {
    sky(ctx, "#1a1209", "#3d2a14", "#7a5226"); dunes(ctx, H * 0.86, 40, t * 300, "#2a1c0e");
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#2a1c0e"; for (let i = 0; i < 3; i++) camel(ctx, W * (0.25 + i * 0.25) + Math.sin(t * 2 + i) * 60, H * 0.78, 1.3 + i * 0.2, t * 3 + i); ctx.restore();
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + t * (0.6 + i * 0.1); lantern(ctx, W / 2 + Math.cos(a) * (300 + i * 90), H * 0.5 + Math.sin(a * 1.3) * (180 + i * 30), 14 + (i % 3) * 8, 3, null, 0.9, t); }
    storm(ctx, t, 0); storm(ctx, t + 3.7, 0); ctx.fillStyle = "rgba(160,110,60,.22)"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#e8c48a"; for (let i = 0; i < 6; i++) { const yy = ((t * 900 + i * 260) % (H + 400)) - 200; ctx.beginPath(); ctx.ellipse(W / 2 + Math.sin(t + i) * 300, yy, W * 0.7, 40, -0.25, 0, 7); ctx.fill(); } ctx.restore();
    grain(ctx, t, 0.08); vignette(ctx, 0.7);
    text(ctx, "حكاية من خيالنا", W / 2, H * 0.1, 48, { alpha: 0.85 * fadeIO(t, 0.2, 4.9, 0.4), color: "#ffe9c8", weight: 500 });
    const k = fadeIO(t, 2.3, 4.9, 0.25); ctx.save(); ctx.fillStyle = `rgba(20,12,4,${0.45 * k})`; ctx.fillRect(0, H * 0.36, W, H * 0.18); ctx.restore(); text(ctx, "وين راح؟!", W / 2 + Math.sin(t * 40) * 6, H * 0.45, 130, { alpha: k, color: "#ffe2b8", glow: 1 });
  } },
  { a: 5, b: 12, title: "سكون", key: 9, vo: "(صمت… ثم يرتفع صوت حُداء بشري وحده)", draw(ctx, t) {
    ctx.fillStyle = "#04050c"; ctx.fillRect(0, 0, W, H); stars(ctx, t, span(t, 6, 10) * 0.6);
    lantern(ctx, W / 2, H * 0.55, 18 + 10 * span(t, 6, 11.5), 1 + 3 * span(t, 6, 11), null, 0.6 + 0.6 * span(t, 6, 11), t);
    text(ctx, "كل قافلة… تحتاج حادي", W / 2, H * 0.3, 80, { alpha: fadeIO(t, 7.2, 11.8, 0.7), color: "#ffe7a8" });
  } },
  { a: 12, b: 35, title: "الفوضى تصير صفًّا", key: 27, vo: "في الصحراء… ما ينجّي القافلة أقواها. ينجّيها إنها تمشي على إيقاع واحد. وكان لكل قافلة حادي… صوته يخلّي الإبل تمشي ولو تعبت.", draw(ctx, t) {
    const beats = [14, 16.5, 19, 21.5]; const order = ease(beats.reduce((n, b) => n + span(t, b, b + 0.6) * 0.25, 0));
    sky(ctx, "#070b22", "#1d2a6e", "#ef8a33", 0.85); stars(ctx, t, 0.6); ridge(ctx, H * 0.7, "#141b4a", 0.8, -100 - t * 4);
    fog(ctx, H * 0.7, 60, 0.12); dunes(ctx, H * 0.76, 34, t * 12, "#121a48"); dunes(ctx, H * 0.79, 26, t * 24 + 300, "#0e1540", 1.3); const cv = span(t, 23, 26);
    ctx.save(); ctx.globalAlpha = 1 - cv; storm(ctx, t, order); ctx.restore();
    if (cv > 0) { ctx.save(); ctx.globalAlpha = cv; ctx.fillStyle = INK; const xf = W * 0.2 - (t - 23) * 18;
      hadi(ctx, xf - 150, H * 0.8, 0.42, t); for (let i = 0; i < 6; i++) { const sc = 1.05 * (1 - 0.05 * (i % 3)); camel(ctx, xf + i * 215, H * 0.8 + (i % 2) * 6, sc, t + i * 0.7); lantern(ctx, xf + i * 215 - 10, H * 0.8 - 175 * sc + (i % 2) * 6, 11, 5, null, 0.9, t); } ctx.restore(); }
    dunes(ctx, H * 0.95, 26, t * 40, "#0a0f2c", 0.8);
    caption(ctx, "في الصحراء… ما ينجّي القافلة أقواها", t, 24.5, 28.5); caption(ctx, "ينجّيها إنها تمشي على إيقاع واحد", t, 28.5, 31.5); caption(ctx, "وكان لكل قافلة حادي… صوته يخلّي الإبل تمشي", t, 31.5, 35);
    vignette(ctx, 0.5);
  } },
  { a: 35, b: 55, title: "الراكب الأخير", key: 47.5, vo: "(القافلة تتوقف لراكب تأخر… خيط ضوء يرجّع له نوره) ما في قافلة وصلت لأن ما أحد فيها تأخر… وصلت لأن ما أحد فيها انترك.", draw(ctx, t) {
    sky(ctx, "#070b22", "#1b2667", "#e7297a", 0.6); stars(ctx, t, 0.8); ridge(ctx, H * 0.72, "#121947", 0.7, 200); fog(ctx, H * 0.73, 50, 0.1); dunes(ctx, H * 0.78, 28, 120, "#121a48"); dunes(ctx, H * 0.8, 24, 300, "#0f153c", 1.3);
    const stop = span(t, 39, 41); const walk = (t - 35) * 22 * (1 - stop);
    const lag = span(t, 36, 40) * (1 - span(t, 46, 50));
    const thread = span(t, 42, 47); const back = span(t, 46.5, 48.5);
    ctx.fillStyle = INK; const xf = W * 0.16 - walk; const X = (i) => xf + i * 215 + (i === 5 ? lag * 300 : 0);
    hadi(ctx, xf - 150, H * 0.83, 0.44, t * (1 - stop * 0.7));
    for (let i = 0; i < 6; i++) camel(ctx, X(i), H * 0.83, 1.08 * (1 - 0.05 * (i % 3)), t * (1 - stop) + i);
    for (let i = 0; i < 6; i++) { const last = i === 5; const lvl = last ? lerp(5, 0.9, span(t, 37, 41)) * (1 - back) + 5 * back : 5; lantern(ctx, X(i) - 10, H * 0.83 - 182 * (1 - 0.05 * (i % 3)), 13, lvl, null, 1, t); }
    if (thread > 0 && back < 1) { const p = thread * 5; ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,214,120,.95)"; ctx.lineWidth = 7; ctx.shadowColor = GLOW; ctx.shadowBlur = 40; ctx.beginPath();
      for (let i = 0; i <= Math.floor(p); i++) { const x = X(i) - 10, y = H * 0.83 - 182 - Math.sin(i * 1.3) * 10; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      const fi = Math.floor(p), fr = p - fi; if (fi < 5) ctx.lineTo(lerp(X(fi), X(fi + 1), fr) - 10, H * 0.83 - 182 - lerp(Math.sin(fi * 1.3), Math.sin((fi + 1) * 1.3), fr) * 10); ctx.stroke(); ctx.restore(); }
    dunes(ctx, H * 0.97, 22, 500, "#0a0f2c", 0.7);
    caption(ctx, "ما في قافلة وصلت لأن ما أحد فيها تأخر…", t, 49, 52.2); caption(ctx, "وصلت لأن ما أحد فيها انترك.", t, 52.2, 55, H * 0.84, 74);
    vignette(ctx, 0.5);
  } },
  { a: 55, b: 70, title: "الطريق", key: 66, vo: "(الكاميرا ترتفع… الصف يصير طريقًا على خريطة المدينة) ترك الحادي ثماني رسائل مختومة… على الطريق.", draw(ctx, t) {
    ctx.fillStyle = "#0b1130"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7); g.addColorStop(0, "#1a2560"); g.addColorStop(1, "#070b22"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = "#8ea0ff"; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(W * 0.5, H * 0.55, 80 + i * 45, 0, 7); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.fillStyle = "#151d52"; ctx.beginPath(); ctx.moveTo(W * 0.02, H * 0.3); for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(W * (0.02 + 0.5 * u), H * (0.3 - 0.13 * Math.sin(u * Math.PI) - 0.03 * Math.sin(u * 17))); } ctx.lineTo(W * 0.52, H * 0.3); ctx.closePath(); ctx.fill(); ctx.restore();
    text(ctx, "أُحد", W * 0.27, H * 0.24, 48, { color: "#7f8fd8", weight: 600, glow: 0 });
    const pts = ROAD.map((_, i) => { const u = i / (ROAD.length - 1); return [W * (0.86 - 0.6 * u) + Math.sin(u * 3.4) * 140, H * (0.84 - 0.48 * u) - Math.sin(u * Math.PI) * 60]; });
    const draw = ease(span(t, 56, 64)) * (pts.length - 1);
    ctx.save(); ctx.strokeStyle = GLOW; ctx.lineWidth = 7; ctx.shadowColor = GLOW; ctx.shadowBlur = 24; ctx.setLineDash([20, 14]); ctx.lineDashOffset = -t * 40; ctx.beginPath();
    for (let i = 0; i <= Math.floor(draw); i++) { const [x, y] = pts[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    const fi = Math.floor(draw), fr = draw - fi; if (fi < pts.length - 1) ctx.lineTo(lerp(pts[fi][0], pts[fi + 1][0], fr), lerp(pts[fi][1], pts[fi + 1][1], fr)); ctx.stroke(); ctx.restore();
    pts.forEach(([x, y], i) => { const k = clamp(draw - i + 1); if (k <= 0) return; ctx.save(); ctx.globalAlpha = k;
      if (i === 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); } else waxSeal(ctx, x, y, 44 * (0.6 + 0.4 * k), 0, 0, t); ctx.restore(); });
    const cur = Math.min(ROAD.length - 1, Math.round(draw)); const [cx, cy] = pts[cur]; text(ctx, ROAD[cur], cx, cy + 86, 50, { color: "#fff", weight: 700 });
    text(ctx, "خريطة رمزية", W * 0.08, H * 0.94, 30, { color: "#7f8fd8", weight: 500, glow: 0 });
    ridge(ctx, H * 1.02, "rgba(10,15,44,.85)", 0.5, 0);
    caption(ctx, "ترك الحادي ثماني رسائل مختومة… على الطريق", t, 64, 70, H * 0.12, 60);
  } },
  { a: 70, b: 80, title: "الالتفاتة", key: 79.2, vo: "والحين… أكلمكم أنتم.", draw(ctx, t) {
    sky(ctx, "#05081c", "#18225f", "#ef8a33", 1); const sun = ctx.createRadialGradient(W / 2, H * 0.78, 10, W / 2, H * 0.78, 520); sun.addColorStop(0, "rgba(255,200,120,.75)"); sun.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    ridge(ctx, H * 0.8, "#0f153c", 0.7, 0); dunes(ctx, H * 0.92, 20, 0, INK);
    hadi(ctx, W * 0.5, H * 1.05, 1.95 + span(t, 70, 80) * 0.08, t, INK, 1, 0.7);
    caption(ctx, "والحين… أكلمكم أنتم.", t, 71, 75.5, H * 0.16, 76);
    CARAVANS.forEach((c, i) => { const k = ease(span(t, 75.5 + i * 0.6, 76.5 + i * 0.6)); if (k <= 0) return; const x = W * (0.84 - i * 0.227); const top = 70; const y = top - 260 + k * 260 + 230; const wv = Math.sin(t * 2.4 + i) * 8;
      ctx.save(); ctx.strokeStyle = "rgba(220,200,160,.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 70, 0); ctx.lineTo(x - 70, y - 230); ctx.moveTo(x + 70, 0); ctx.lineTo(x + 70, y - 230); ctx.stroke();
      const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0); g.addColorStop(0, mixHex(c.color, "#000000", 0.3)); g.addColorStop(0.5, c.color); g.addColorStop(1, mixHex(c.color, "#000000", 0.3));
      ctx.fillStyle = g; ctx.shadowColor = c.color; ctx.shadowBlur = 30; ctx.beginPath(); ctx.moveTo(x - 90, y - 230); ctx.lineTo(x + 90, y - 230); ctx.quadraticCurveTo(x + 90 + wv, y - 110, x + 90, y); ctx.lineTo(x, y - 36); ctx.lineTo(x - 90, y); ctx.quadraticCurveTo(x - 90 + wv, y - 110, x - 90, y - 230); ctx.closePath(); ctx.fill(); ctx.restore();
      text(ctx, c.name, x, y - 130, 50); });
    vignette(ctx, 0.45);
  } },
  { a: 80, b: 100, title: "الفانوس", key: 96, vo: "كل واحد فيكم يحمل فانوس فيه خمسة أنوار. إذا كل فوانيس القافلة نورها أربعة أو أكثر… تاخذ القافلة نجمة. وكل نجمة… بطاقة قوة تلعبونها في الملعب. والباقي… تكتشفونه في الطريق.", draw(ctx, t) {
    sky(ctx, "#05081c", "#121a4d", "#27378a", 0.4); stars(ctx, t, 0.5);
    const p1 = span(t, 80, 88), p2 = span(t, 88, 93), p3 = span(t, 93, 100);
    if (t < 88.6) { ctx.save(); ctx.globalAlpha = 1 - span(t, 87.9, 88.6); const lit = Math.floor(p1 * 5.99);
      lantern(ctx, W / 2, H * 0.42, 80, Math.min(5, lit + 0.5), null, 1.1);
      LIGHTS.forEach(([name, col], i) => { const on = i < lit; const x = W / 2 + (i - 2) * 340; const y = H * 0.68; ctx.fillStyle = on ? col : "rgba(255,255,255,.08)"; ctx.shadowColor = col; ctx.shadowBlur = on ? 40 : 0; ctx.beginPath(); ctx.arc(x, y, 38, 0, 7); ctx.fill(); ctx.shadowBlur = 0; text(ctx, name, x, y + 84, 48, { alpha: on ? 1 : 0.35, weight: 600 }); });
      ctx.restore(); }
    if (t > 88.4 && p3 < 1) { ctx.save(); ctx.globalAlpha = span(t, 88.4, 89.2) * (1 - span(t, 93.3, 94));
      for (let r = 0; r < 5; r++) { const lx = W * 0.22 + r * 150, n = r === 2 ? 4 : 5; lantern(ctx, lx, H * 0.45, 30, n, null, 0.9, t);
        LIGHTS.forEach(([, col], j) => { ctx.fillStyle = j < n ? col : "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(lx - 44 + j * 22, H * 0.45 + 70, 8, 0, 7); ctx.fill(); }); }
      const st = span(t, 90, 92); const sx = lerp(W * 0.54, W * 0.78, ease(st)), sy = lerp(H * 0.38, H * 0.5, ease(st));
      text(ctx, "⭐", sx, sy, 110 + 30 * Math.sin(t * 6) * (1 - st), { glow: 1, alpha: 1 - span(t, 92.6, 93.2) }); camel(ctx, W * 0.82 + ease(span(t, 92, 93)) * 0, H * 0.62, 0.7, t); ctx.restore(); }
    if (p3 > 0) { ctx.save(); ctx.globalAlpha = span(t, 93, 94);
      [-1, 1].forEach((d) => powerCard(ctx, W / 2 + d * 330, H * 0.47, 250, 0, t)); powerCard(ctx, W / 2, H * 0.45, 330, ease(span(t, 94, 95.5)), t); ctx.restore(); }
    caption(ctx, "كل واحد يحمل فانوس فيه خمسة أنوار", t, 80.5, 87.8, H * 0.12, 60);
    caption(ctx, "كل الفوانيس 4 أنوار أو أكثر = نجمة للقافلة", t, 88.4, 93.2, H * 0.8, 60);
    caption(ctx, "وكل نجمة… بطاقة قوة تلعبونها في الملعب", t, 95.5, 98.2, H * 0.88, 62); caption(ctx, "والباقي… تكتشفونه في الطريق", t, 98.2, 100, H * 0.88, 62);
    vignette(ctx, 0.5);
  } },
  { a: 100, b: 115, title: "الرسالة الأولى", key: 109, vo: "الرسالة الأولى ما تنفتح… إلا إذا أخذت قافلتين نجمة في نفس الخميس.", draw(ctx, t) {
    ctx.fillStyle = "#06081a"; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, 700); g.addColorStop(0, "rgba(154,29,40,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const shake = span(t, 104, 108) * (1 - span(t, 112, 114)) * (0.5 + 0.5 * Math.sin(t * 3)); waxSeal(ctx, W / 2, H * 0.43, 220, span(t, 106, 112), shake, t);
    caption(ctx, "الرسالة الأولى ما تنفتح…", t, 101, 107.5, H * 0.8, 70); caption(ctx, "إلا إذا أخذت قافلتين نجمة في نفس الخميس", t, 107.5, 115, H * 0.8, 66);
    vignette(ctx, 0.6);
  } },
  { a: 115, b: 130, title: "الكشف", key: 125, vo: "الحادي… مو أنا. كل خميس، واحد منكم. يمكن تكون أنت… اللي يجمع قافلته.", draw(ctx, t) {
    sky(ctx, "#05081c", "#18225f", "#ef8a33", 0.9); const sun = ctx.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, 600); sun.addColorStop(0, `rgba(255,214,140,${0.5 + 0.4 * span(t, 118, 122)})`); sun.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    dunes(ctx, H * 0.92, 20, 0, INK);
    const m = ease(span(t, 118.5, 121.5));
    ctx.save(); ctx.globalAlpha = 1 - m; hadi(ctx, W / 2, H * 0.92, 1.3, t, INK, 1 - span(t, 117, 119), 0.6); ctx.restore();
    const fall = span(t, 117, 119.5); if (fall > 0) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = INK; ctx.translate(W / 2 - 60 * fall, H * 0.92 - 470 * (1 - ease(fall)) - 10); ctx.rotate(fall * 1.2); ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = m; boy(ctx, W / 2, H * 0.92, 1.5, INK, t); ctx.restore();
    if (m > 0.6) { const f = rng(5); ctx.save(); for (let i = 0; i < 60; i++) { ctx.globalAlpha = (m - 0.6) * 2 * f(); ctx.fillStyle = GLOW; ctx.beginPath(); ctx.arc(W / 2 + (f() - 0.5) * 500, H * 0.92 - f() * 600 - (t - 120) * 20 * f(), 2 + f() * 3, 0, 7); ctx.fill(); } ctx.restore(); }
    caption(ctx, "الحادي… مو أنا.", t, 116, 119, H * 0.14, 76); caption(ctx, "كل خميس… واحد منكم.", t, 121.5, 125.5, H * 0.14, 76); caption(ctx, "يمكن تكون أنت… اللي يجمع قافلته.", t, 125.5, 130, H * 0.14, 70);
    vignette(ctx, 0.45);
  } },
  { a: 130, b: 142, title: "النهاية", key: 138, vo: "الخميس، الساعة خمس… أول نجمة، أول بطاقة في تاريخ الطريق.", draw(ctx, t, img) {
    ctx.fillStyle = "#060918"; ctx.fillRect(0, 0, W, H); stars(ctx, t, 0.7);
    text(ctx, "الخميس · 5:00", W / 2, H * 0.24, 110, { alpha: fadeIO(t, 130.5, 142, 0.8), color: GLOW });
    text(ctx, "أول نجمة… أول بطاقة في تاريخ الطريق", W / 2, H * 0.38, 62, { alpha: fadeIO(t, 132.5, 142, 0.8) });
    const k = span(t, 135, 136.5); if (img && img.complete && img.naturalWidth) { ctx.save(); ctx.globalAlpha = k; const w = 640, h = w * img.naturalHeight / img.naturalWidth; ctx.drawImage(img, W / 2 - w / 2, H * 0.6 - h / 2, w, h); ctx.restore(); }
    text(ctx, "أتحدى وأتعاون", W / 2, H * 0.84, 60, { alpha: k, color: "#ffe7a8", weight: 600 });
    ctx.save(); ctx.fillStyle = "#0d1336"; dunes(ctx, H * 0.97, 14, 0, "#0b1030"); ctx.fillStyle = "#141c4c"; const cx = W + 200 - ((t - 130) * 70); for (let i = 0; i < 5; i++) camel(ctx, cx + i * 70, H * 0.955, 0.32, t + i); ctx.restore();
  } },
];
/** pauses that freeze the picture for a beat of silence: [content time, seconds] */
const HOLDS = [[54.4, 2.5], [99.4, 1.5]];
export const toContent = (r) => { let c = r; for (const [at, d] of HOLDS) { if (c <= at) break; c = Math.max(at, c - d); } return c; };
export const toReal = (c) => c + HOLDS.filter(([at]) => at < c).reduce((n, h) => n + h[1], 0);
export const DURATION = toReal(SCENES[SCENES.length - 1].b);
export function drawAt(ctx, tReal, img) {
  const t = toContent(tReal);
  const s = SCENES.find((x) => t >= x.a && t < x.b) || SCENES[SCENES.length - 1];
  ctx.save(); s.draw(ctx, t, img); ctx.restore();
  // short dip to black between scenes
  const edge = Math.min(t - s.a, s.b - t); if (edge < 0.35) { ctx.fillStyle = `rgba(0,0,0,${1 - edge / 0.35})`; ctx.fillRect(0, 0, W, H); }
}

/** narration cues, spoken by the device's Arabic voice (or replaced by a recorded voice.mp3 if one is added) */
export const VO = [
  { t: 2.6, s: "وين راح؟!", rate: 1.15, pitch: 1.15 },
  { t: 7.4, s: "كل قافلة… تحتاج حادي.", rate: 0.82, pitch: 0.9 },
  { t: 24.6, s: "في الصحراء… ما يُنَجِّي القافلة أقواها." },
  { t: 28.6, s: "يُنَجِّيها إنها تمشي على إيقاعٍ واحد." },
  { t: 31.6, s: "وكان لكل قافلة حادي… صوته يخلّي الإبل تمشي، ولو تعبت." },
  { t: 49.0, s: "ما في قافلة وصلت لأن ما أحد فيها تأخّر…", rate: 0.95 },
  { t: 53.4, s: "وصلت… لأن ما أحد فيها انْترك.", rate: 0.85 },
  { t: 64.2, s: "ترك الحادي ثماني رسائل مختومة… على الطريق." },
  { t: 71.2, s: "والحين… أكلّمكم أنتم.", pitch: 0.85, rate: 0.8 },
  { t: 76.6, s: "أربع قوافل: أُحُد، القبلتين، قُباء، العقيق." },
  { t: 80.8, s: "كل واحد فيكم يحمل فانوس، فيه خمسة أنوار." },
  { t: 88.2, s: "إذا كل فوانيس القافلة نورها أربعة أو أكثر… تاخذ القافلة نجمة." },
  { t: 95.3, s: "وكل نجمة… بطاقة قوة، مثل الهدف الذهبي." },
  { t: 99.38, s: "والباقي… تكتشفونه في الطريق." },
  { t: 101.2, s: "الرسالة الأولى… ما تنفتح…" },
  { t: 107.6, s: "إلا إذا أخذت قافلتين نجمة، في نفس الخميس." },
  { t: 116.2, s: "الحادي… مو أنا.", pitch: 0.85, rate: 0.8 },
  { t: 121.6, s: "كل خميس… واحد منكم.", pitch: 0.85, rate: 0.85 },
  { t: 125.6, s: "يمكن تكون أنت… اللي يجمع قافلته.", pitch: 0.85, rate: 0.85 },
  { t: 131, s: "الخميس، الساعة خمسة." },
  { t: 133.2, s: "أول نجمة… أول بطاقة، في تاريخ الطريق." },
  { t: 137.0, s: "أتحدّى… وأتعاون.", rate: 0.85 },
];
export const VO_REAL = VO.map((c) => ({ ...c, t: toReal(c.t) }));
