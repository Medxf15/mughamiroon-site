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

// ---------- shared pieces ----------
function nightSky(ctx, t, hz = "#ef8a33", a = 0.8) { sky(ctx, "#060a20", "#1b2667", hz, a); stars(ctx, t, 0.7); }
function desert(ctx, t, speed = 1) { ridge(ctx, H * 0.7, "#141b4a", 0.8, -100 - t * 3 * speed); fog(ctx, H * 0.7, 60, 0.1); dunes(ctx, H * 0.76, 34, t * 12 * speed, "#121a48"); dunes(ctx, H * 0.79, 26, t * 24 * speed + 300, "#0e1540", 1.3); }
function front(ctx, t, speed = 1) { dunes(ctx, H * 0.96, 24, t * 40 * speed, "#0a0f2c", 0.8); }
/** dots under a lantern showing how many of the five lights it has */
function dots(ctx, x, y, n, r = 9, gap = 24) { LIGHTS.forEach(([, col], j) => { ctx.fillStyle = j < n ? col : "rgba(255,255,255,.13)"; if (j < n) { ctx.shadowColor = col; ctx.shadowBlur = 12; } ctx.beginPath(); ctx.arc(x - gap * 2 + j * gap, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }); }
/** a caravan of five lanterns in a row (levels array) */
function lanternRow(ctx, t, levels, cx = W / 2, y = H * 0.42, gap = 250, r = 40) {
  levels.forEach((n, i) => { const x = cx + (i - 2) * gap; const k = Math.round(n); lantern(ctx, x, y, r, n, null, 1, t); dots(ctx, x, y + r * 1.9, k, 13, 32);
    text(ctx, `${k}/5`, x, y + r * 1.9 + 56, 46, { color: k >= 4 ? "#7cf0b4" : "#ffb648", weight: 700 }); });
}
/** horizontal road strip with stations, sealed letters and the caravan's camel */
function roadStrip(ctx, t, pos, opened = 0, y = H * 0.84) {
  const x0 = W * 0.9, x1 = W * 0.1; const X = (i) => lerp(x0, x1, i / (ROAD.length - 1));
  ctx.save(); ctx.strokeStyle = "rgba(255,207,107,.35)"; ctx.lineWidth = 6; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = GLOW; ctx.shadowColor = GLOW; ctx.shadowBlur = 16; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, pos / (ROAD.length - 1)), y); ctx.stroke(); ctx.restore();
  for (let i = 0; i < ROAD.length; i++) { const x = X(i);
    if (i === 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); }
    else waxSeal(ctx, x, y, 30, i <= opened ? 1 : 0, 0, t);
    if (i <= 1 || i === ROAD.length - 1) text(ctx, ROAD[i], x, y + 58, 34, { weight: 600, color: "#dfe5ff" }); }
  ctx.fillStyle = INK; ctx.save(); ctx.shadowColor = "rgba(255,207,107,.8)"; ctx.shadowBlur = 18; camel(ctx, lerp(x0, x1, pos / (ROAD.length - 1)), y - 26, 0.62, t); ctx.restore();
}
function starShape(ctx, x, y, r, a = 1, crack = 0) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.fillStyle = "#ffd34d"; ctx.shadowColor = "#ffcf6b"; ctx.shadowBlur = 50 * a;
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const an = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
  if (crack > 0) { ctx.shadowBlur = 0; ctx.strokeStyle = "#1a1300"; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.8); ctx.lineTo(r * 0.12, -r * 0.2); ctx.lineTo(-r * 0.15, r * 0.15); ctx.lineTo(r * 0.1, r * 0.6 * crack); ctx.stroke(); }
  ctx.restore();
}
const DUTY_ICONS = [["🕌", "حُرّاس المصلى", "#1fa865"], ["🎙️", "منبر القافلة", "#0a63e6"], ["🍽️", "أُمناء الزاد", "#ef8a33"], ["✨", "رُوّاد النظافة", "#e7297a"]];
export const POWER_DECK = [
  { k: "golden", icon: "⚡", name: "الهدف الذهبي", tier: "أسطورية", rule: "دقيقتين: هدفكم بهدفين", c1: "#a8700f", c2: "#3a1d52" },
  { k: "shield", icon: "🛡️", name: "الدرع", tier: "أسطورية", rule: "دقيقتين: أول هدف عليكم ما يُحسب", c1: "#a8700f", c2: "#3a1d52" },
  { k: "extra", icon: "🦸", name: "الفزعة الكبرى", tier: "نادرة", rule: "مشرف من اختياركم يلعب معكم دقيقتين", c1: "#1f6a8a", c2: "#10294a" },
  { k: "freekick", icon: "🎯", name: "الركلة الحرة", tier: "نادرة", rule: "ركلة حرة مباشرة من نص الملعب", c1: "#1f6a8a", c2: "#10294a" },
  { k: "timeout", icon: "⏱️", name: "الوقت المستقطع", tier: "عادية", rule: "دقيقة توقف لخطة القافلة", c1: "#3a4680", c2: "#1a2250" },
  { k: "kickoff", icon: "🧭", name: "اختيار البداية", tier: "عادية", rule: "تختارون الملعب وضربة البداية", c1: "#3a4680", c2: "#1a2250" },
];
function deckCard(ctx, x, y, w, card, flip, t, glowK = 1) {
  const h = w * 88 / 63; const k = Math.cos(Math.PI * (1 - clamp(flip))); const face = k > 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(Math.abs(k), 0.02), 1);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (face) { g.addColorStop(0, card.c1); g.addColorStop(1, card.c2); } else { g.addColorStop(0, "#27378a"); g.addColorStop(1, "#0f1540"); }
  ctx.shadowColor = face ? "rgba(255,200,80,.8)" : "rgba(0,0,0,.6)"; ctx.shadowBlur = face ? 70 * glowK : 30; ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.07); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = face ? "#ffd36b" : "#6b7cff"; ctx.lineWidth = w * 0.02; roundRect(ctx, -w / 2 + w * 0.05, -h / 2 + w * 0.05, w * 0.9, h - w * 0.1, w * 0.05); ctx.stroke();
  if (face) { text(ctx, card.tier, 0, -h * 0.38, w * 0.08, { color: "#ffe7a8", weight: 600, glow: 0 });
    if (card.k === "golden") lightning(ctx, 0, -h * 0.12, w * 0.42); else text(ctx, card.icon, 0, -h * 0.12, w * 0.34, { glow: 0.3 });
    text(ctx, card.name, 0, h * 0.16, w * 0.12); wrapText(ctx, card.rule, 0, h * 0.31, w * 0.8, w * 0.075, "#ffe7a8"); }
  else { ctx.save(); ctx.globalAlpha = 0.5; waxSeal(ctx, 0, -h * 0.05, w * 0.22, 0, 0, t); ctx.restore(); text(ctx, "؟", 0, h * 0.26, w * 0.2, { color: "#9fb0ff", glow: 0 }); }
  ctx.restore();
}
function wrapText(ctx, str, x, y, maxW, size, color = "#fff") {
  ctx.save(); ctx.font = `600 ${size}px ${FONT}`; const words = str.split(" "); const lines = []; let line = "";
  for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; } lines.push(line); ctx.restore();
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * 1.35, size, { weight: 600, color, glow: 0 }));
}

// ---------- segments ----------
// t = seconds since the segment started (keeps running while waiting for an interaction)
// st = shared interactive state: { drawn: [card], cheer: Set(index), choice }
export const SEGMENTS = [
  { id: "storm", title: "وسط العاصفة", dur: 5, key: 3.6, amb: "storm",
    sfx: [[0, "storm", 1]], vo: [{ t: 2.6, s: "وين راح؟!", rate: 1.15, pitch: 1.15 }],
    draw(ctx, t) {
      sky(ctx, "#1a1209", "#3d2a14", "#7a5226"); dunes(ctx, H * 0.86, 40, t * 300, "#2a1c0e");
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#2a1c0e"; for (let i = 0; i < 3; i++) camel(ctx, W * (0.25 + i * 0.25) + Math.sin(t * 2 + i) * 60, H * 0.78, 1.3 + i * 0.2, t * 3 + i); ctx.restore();
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + t * (0.6 + i * 0.1); lantern(ctx, W / 2 + Math.cos(a) * (300 + i * 90), H * 0.5 + Math.sin(a * 1.3) * (180 + i * 30), 14 + (i % 3) * 8, 3, null, 0.9, t); }
      storm(ctx, t, 0); storm(ctx, t + 3.7, 0); ctx.fillStyle = "rgba(160,110,60,.22)"; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#e8c48a"; for (let i = 0; i < 6; i++) { const yy = ((t * 900 + i * 260) % (H + 400)) - 200; ctx.beginPath(); ctx.ellipse(W / 2 + Math.sin(t + i) * 300, yy, W * 0.7, 40, -0.25, 0, 7); ctx.fill(); } ctx.restore();
      grain(ctx, t, 0.08); vignette(ctx, 0.7);
      text(ctx, "حكاية من خيالنا", W / 2, H * 0.1, 48, { alpha: 0.85 * fadeIO(t, 0.2, 4.9, 0.4), color: "#ffe9c8", weight: 500 });
      const k = fadeIO(t, 2.3, 4.9, 0.25); ctx.save(); ctx.fillStyle = `rgba(20,12,4,${0.45 * k})`; ctx.fillRect(0, H * 0.36, W, H * 0.18); ctx.restore(); text(ctx, "وين راح؟!", W / 2 + Math.sin(t * 40) * 6, H * 0.45, 130, { alpha: k, color: "#ffe2b8", glow: 1 });
    } },
  { id: "hadi", title: "كل قافلة تحتاج حادي", dur: 8, key: 5.5, amb: "wind",
    sfx: [[0, "whoosh", 0.6], [3.5, "ignite", 0.7]], vo: [{ t: 1.0, s: "كل قافلة… تحتاج حادي.", rate: 0.82, pitch: 0.9 }, { t: 4.4, s: "صوته… يخلّي الإبل تمشي، ولو تعبت.", rate: 0.88 }],
    draw(ctx, t) {
      nightSky(ctx, t, "#ef8a33", 0.6 * span(t, 0, 4)); ridge(ctx, H * 0.78, "#0f153c", 0.6, 0);
      const k = span(t, 3.2, 5); ctx.save(); ctx.globalAlpha = k; hadi(ctx, W * 0.5, H * 0.95, 1.2, t, INK, 1, 0.5); ctx.restore();
      lantern(ctx, W * 0.5 + 95 * 1.2, H * 0.95 - 330 * 1.2 * 0.62, 22, 1 + 4 * span(t, 3.5, 4.5), null, 1, t);
      text(ctx, "كل قافلة… تحتاج حادي", W / 2, H * 0.16, 84, { alpha: fadeIO(t, 0.6, 7.8, 0.7), color: "#ffe7a8" });
      caption(ctx, "صوته يخلّي الإبل تمشي… ولو تعبت", t, 4.4, 8);
      vignette(ctx, 0.5);
    } },
  { id: "order", title: "الفوضى تصير صفًّا", dur: 14, key: 12, amb: "wind",
    sfx: [[1.5, "beat", 1], [4, "beat", 1], [6.5, "beat", 1], [9, "beat", 1], [10, "steps"]],
    vo: [{ t: 10, s: "القافلة… تنجو لما تمشي على إيقاعٍ واحد." }],
    draw(ctx, t) {
      const beats = [1.5, 4, 6.5, 9]; const order = ease(beats.reduce((n, b) => n + span(t, b, b + 0.6) * 0.25, 0));
      nightSky(ctx, t, "#ef8a33", 0.85); desert(ctx, t);
      const cv = span(t, 9.4, 11.5); ctx.save(); ctx.globalAlpha = 1 - cv; storm(ctx, t + 12, order); ctx.restore();
      beats.forEach((b) => { const p = span(t, b, b + 0.5); if (p > 0 && p < 1) { ctx.save(); ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = GLOW; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H * 0.62, 100 + p * 900, 0, 7); ctx.stroke(); ctx.restore(); } });
      if (cv > 0) { ctx.save(); ctx.globalAlpha = cv; ctx.fillStyle = INK; const xf = W * 0.2 - (t - 9.4) * 18;
        hadi(ctx, xf - 150, H * 0.8, 0.42, t); for (let i = 0; i < 6; i++) { const sc = 1.05 * (1 - 0.05 * (i % 3)); camel(ctx, xf + i * 215, H * 0.8 + (i % 2) * 6, sc, t + i * 0.7); lantern(ctx, xf + i * 215 - 10, H * 0.8 - 175 * sc + (i % 2) * 6, 11, 5, null, 0.9, t); } ctx.restore(); }
      front(ctx, t);
      caption(ctx, "القافلة تنجو… لما تمشي على إيقاع واحد", t, 10, 14);
      vignette(ctx, 0.5);
    } },
  { id: "lantern", title: "فانوسك وأنواره الخمسة", dur: 12, key: 10.5, amb: "night",
    sfx: [[2, "ignite", 0.8], [3.6, "ignite", 0.8], [5.2, "ignite", 0.8], [6.8, "ignite", 0.8], [8.4, "ignite", 0.9]],
    vo: [{ t: 0.4, s: "كل واحد فيكم… يحمل فانوس." }, { t: 2, s: "الالتزام", rate: 1 }, { t: 3.6, s: "التعاون", rate: 1 }, { t: 5.2, s: "المهارة", rate: 1 }, { t: 6.8, s: "الروح الرياضية", rate: 1 }, { t: 8.4, s: "الأخلاق", rate: 1 }, { t: 9.8, s: "هذا… نورك.", rate: 0.8 }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#121a4d", "#27378a", 0.4); stars(ctx, t, 0.5);
      const lit = [2, 3.6, 5.2, 6.8, 8.4].filter((x) => t >= x).length;
      lantern(ctx, W / 2, H * 0.4, 95, Math.max(0.5, lit), null, 1.2, t);
      LIGHTS.forEach(([name, col], i) => { const on = i < lit; const x = W / 2 + (i - 2) * 340; const y = H * 0.74; const pop = on ? 1 + 0.25 * (1 - span(t, [2, 3.6, 5.2, 6.8, 8.4][i], [2, 3.6, 5.2, 6.8, 8.4][i] + 0.4)) : 1;
        ctx.fillStyle = on ? col : "rgba(255,255,255,.08)"; ctx.shadowColor = col; ctx.shadowBlur = on ? 45 : 0; ctx.beginPath(); ctx.arc(x, y, 40 * pop, 0, 7); ctx.fill(); ctx.shadowBlur = 0; text(ctx, name, x, y + 88, 50, { alpha: on ? 1 : 0.3, weight: 700 }); });
      caption(ctx, "كل واحد فيكم يحمل فانوس", t, 0.3, 1.9, H * 0.1, 62); caption(ctx, "هذا… نورك.", t, 9.8, 12, H * 0.1, 80);
      vignette(ctx, 0.5);
    } },
  { id: "star", title: "نور القافلة يصنع النجمة", dur: 15, key: 13.5, amb: "night",
    sfx: [[6.6, "star", 1], [9.2, "step", 1], [9.8, "step", 1], [11.2, "wax", 0.9], [11.8, "paper", 0.8]],
    vo: [{ t: 0.4, s: "والقافلة… نورها من نور كل واحد فيها." }, { t: 3.4, s: "إذا كل فوانيسها… أربعة أنوار أو أكثر…" }, { t: 6.8, s: "تاخذ القافلة… نجمة!", rate: 0.95, pitch: 1.05 }, { t: 9.4, s: "وكل نجمة… خطوة على الطريق." }, { t: 12.2, s: "وكل محطة… فيها رسالة مختومة." }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#141c52", "#27378a", 0.5); stars(ctx, t, 0.5);
      lanternRow(ctx, t, [5, 4, 5, 4, 5], W / 2, H * 0.3, 260, 38);
      caption(ctx, "كل فوانيس القافلة 4 أنوار أو أكثر", t, 3.3, 6.6, H * 0.55, 60);
      const sp = span(t, 6.6, 7.4), fly = ease(span(t, 8.2, 9.4));
      if (t > 6.6 && fly < 1) starShape(ctx, lerp(W / 2, W * 0.9, fly), lerp(H * 0.57, H * 0.8, fly), 70 * ease(sp) * (1 - fly * 0.6), 1);
      if (t > 6.6 && t < 8.2) text(ctx, "نجمة!", W / 2, H * 0.68, 70, { alpha: span(t, 6.8, 7.3), color: "#ffd34d" });
      const pos = ease(span(t, 9.2, 10.6)); roadStrip(ctx, t, pos, t > 11.2 ? 1 : 0, H * 0.84);
      if (t > 11.2) { const k = span(t, 11.2, 12); text(ctx, "📜 رسالة… انفتحت!", W * 0.79, H * 0.72, 46, { alpha: k, color: "#ffe7a8" }); }
      caption(ctx, "كل نجمة = خطوة · كل محطة = رسالة مختومة", t, 9.4, 15, H * 0.62, 56);
      vignette(ctx, 0.45);
    } },
  { id: "problem", title: "لو واحد ما التزم", dur: 10, key: 7.5, amb: "night",
    sfx: [[1.5, "swell", 0.8], [6.2, "break", 1]],
    vo: [{ t: 0.4, s: "كلنا… يجينا يوم نورنا يضعف." }, { t: 3.4, s: "ولو نور واحد بس… نقص عن أربعة…" }, { t: 6.4, s: "نجمة القافلة كلها… ما تطلع.", rate: 0.85 }],
    interact: { type: "choice", q: "وش تسوي القافلة؟", opts: [["⏩", "نكمل ونتركه"], ["🤝", "نرجع له"]], next: ["leave", "fazaa"] },
    draw(ctx, t) {
      sky(ctx, "#05081c", "#141c52", "#3a1030", 0.5 * span(t, 1, 5)); stars(ctx, t, 0.5);
      const dim = lerp(5, 3, ease(span(t, 2, 5)));
      lanternRow(ctx, t, [5, 4, dim, 4, 5], W / 2, H * 0.3, 260, 38);
      if (t > 2) { ctx.save(); ctx.globalAlpha = 0.6 * span(t, 2, 3) * (0.6 + 0.4 * Math.sin(t * 6)); ctx.strokeStyle = "rgba(255,182,72,.7)"; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(W / 2, H * 0.3, 90, 0, 7); ctx.stroke(); ctx.restore(); }
      const tr = span(t, 5.2, 6.2); if (t > 5.2) starShape(ctx, W / 2, H * 0.6 - tr * 30 + (t > 6.2 ? (t - 6.2) * 60 : 0), 70, t > 6.2 ? Math.max(0, 1 - (t - 6.2) * 0.8) : tr, t > 6.2 ? 1 : 0);
      roadStrip(ctx, t, 1, 1, H * 0.86);
      caption(ctx, "كلنا يجينا يوم نورنا يضعف…", t, 0.4, 3.3, H * 0.1, 64); caption(ctx, "ولو نور واحد نقص عن 4…", t, 3.4, 6.3, H * 0.1, 64); caption(ctx, "نجمة القافلة كلها… ما تطلع", t, 6.4, 10, H * 0.1, 66);
      vignette(ctx, 0.5);
    } },
  { id: "leave", title: "نكمل ونتركه؟", dur: 10, key: 6, amb: "wind", sfx: [[0.3, "whoosh", 0.4], [4.2, "break", 0.6]],
    vo: [{ t: 0.4, s: "تكملون… وتتركونه؟" }, { t: 2.4, s: "القافلة توصل… ناقصة." }, { t: 4.6, s: "لا نجمة… لا خطوة… ولا بطاقة.", rate: 0.85 }, { t: 7.4, s: "النجمة ما تطلع… إلا لما يوصل الكل.", rate: 0.85 }],
    interact: { type: "choice", q: "تبون تشوفون لو رجعتوا له؟", opts: [["🤝", "نشوف لو رجعنا له"], ["⏭️", "كمّل الفيلم"]], next: ["fazaa", "you"] },
    draw(ctx, t) {
      nightSky(ctx, t, "#3a1030", 0.6); desert(ctx, t * 0.5, 0.5);
      const go = t * 70; ctx.fillStyle = INK; const xf = W * 0.25 - go;
      hadi(ctx, xf - 150, H * 0.83, 0.44, t); for (let i = 0; i < 5; i++) { camel(ctx, xf + i * 215, H * 0.83, 1.05, t + i); lantern(ctx, xf + i * 215 - 10, H * 0.83 - 182, 13, 5, null, 1, t); }
      camel(ctx, W * 0.86, H * 0.83, 1.05, 0); lantern(ctx, W * 0.86 - 10, H * 0.83 - 182, 13, 3 - 2 * span(t, 1, 5), null, 1, t);
      front(ctx, t * 0.5, 0.5);
      if (t > 3.6) starShape(ctx, W / 2, H * 0.32, 70, Math.max(0, 1 - (t - 4) * 0.5), 1);
      caption(ctx, "القافلة توصل… ناقصة", t, 2.4, 4.5, H * 0.1, 64); caption(ctx, "لا نجمة · لا خطوة · لا بطاقة", t, 4.6, 7.3, H * 0.1, 64); caption(ctx, "النجمة ما تطلع… إلا لما يوصل الكل", t, 7.4, 10, H * 0.1, 64);
      if (t > 4.4) { ctx.save(); ctx.globalAlpha = span(t, 4.4, 5) * 0.9; deckCard(ctx, W * 0.82, H * 0.34, 150, POWER_DECK[0], 0, t, 0); text(ctx, "🔒", W * 0.82, H * 0.34, 90, {}); ctx.restore(); }
      vignette(ctx, 0.5);
    } },
  { id: "fazaa", title: "الفزعة", dur: 13, key: 7.6, amb: "night", sfx: [[2.2, "shimmer", 0.9], [4.8, "ignite", 1], [6.4, "star", 1]],
    vo: [{ t: 0.4, s: "ترجع له… وتفزع له." }, { t: 4.6, s: "ويرجع نوره… وتطلع النجمة!", pitch: 1.05 }, { t: 8.4, s: "ما في قافلة وصلت لأن ما أحد فيها تأخّر…", rate: 0.92 }, { t: 11, s: "وصلت… لأن ما أحد فيها انْترك.", rate: 0.82 }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#141c52", "#27378a", 0.5); stars(ctx, t, 0.6);
      const xs = [0, 1, 2, 3, 4].map((i) => W / 2 + (i - 2) * 260); const thread = span(t, 2.2, 4.6);
      const lv = [5, 4, t < 4.8 ? 3 : 4, 4, 5]; lanternRow(ctx, t, lv, W / 2, H * 0.3, 260, 38);
      if (thread > 0 && t < 5.6) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,214,120,.95)"; ctx.lineWidth = 8; ctx.shadowColor = GLOW; ctx.shadowBlur = 40; ctx.globalAlpha = 1 - span(t, 5, 5.6);
        [[0, 2], [4, 2], [1, 2], [3, 2]].forEach(([a, b], k) => { const p = clamp(thread * 1.4 - k * 0.12); if (p <= 0) return; ctx.beginPath(); ctx.moveTo(xs[a], H * 0.3); ctx.quadraticCurveTo((xs[a] + xs[b]) / 2, H * 0.3 - 120, lerp(xs[a], xs[b], p), H * 0.3 - Math.sin(p * Math.PI) * 60); ctx.stroke(); }); ctx.restore(); }
      if (t > 6.4) starShape(ctx, W / 2, H * 0.6, 80 * ease(span(t, 6.4, 7.2)) * (1 + 0.05 * Math.sin(t * 4)), 1);
      caption(ctx, "ترجع له… وتفزع له", t, 0.4, 4.5, H * 0.1, 66); caption(ctx, "ويرجع نوره… وتطلع النجمة!", t, 4.6, 8.3, H * 0.1, 66);
      caption(ctx, "ما في قافلة وصلت لأن ما أحد فيها تأخر…", t, 8.4, 10.9, H * 0.84, 60); caption(ctx, "وصلت… لأن ما أحد فيها انترك.", t, 11, 13, H * 0.84, 72);
      vignette(ctx, 0.45);
    } },
  { id: "you", title: "نورك نور قافلتك", dur: 7, key: 4.5, amb: "night", sfx: [[0.2, "whoosh", 0.5]],
    vo: [{ t: 0.5, s: "انضباطك… مو لك بروحك.", rate: 0.85 }, { t: 3.4, s: "هو نور قافلتك… كلها.", rate: 0.82 }],
    draw(ctx, t) {
      ctx.fillStyle = "#04050c"; ctx.fillRect(0, 0, W, H);
      const r = 70 + 50 * ease(span(t, 0, 3)); lantern(ctx, W / 2, H * 0.48, r, 5, null, 1.4, t);
      CARAVANS.forEach((c, i) => { const a = (i / 4) * Math.PI * 2 + t * 0.4; const k = span(t, 3.2, 4.4); ctx.save(); ctx.globalAlpha = k; lantern(ctx, W / 2 + Math.cos(a) * 420, H * 0.48 + Math.sin(a) * 260, 26, 5, null, 0.9, t); ctx.restore(); });
      text(ctx, "انضباطك… مو لك بروحك", W / 2, H * 0.12, 74, { alpha: fadeIO(t, 0.4, 7, 0.5), color: "#fff" });
      text(ctx, "هو نور قافلتك كلها", W / 2, H * 0.88, 80, { alpha: fadeIO(t, 3.3, 7, 0.5), color: "#ffd34d" });
    } },
  { id: "duty", title: "نجمة التكليف", dur: 12, key: 10.5, amb: "night", sfx: [[0.6, "flag", 0.5], [5.4, "tick", 0.8], [7, "tick", 0.8], [8.4, "star", 1]],
    vo: [{ t: 0.4, s: "وكل قافلة… لها تكليف كل خميس." }, { t: 4.8, s: "تتقنه مرتين…" }, { t: 8.6, s: "تاخذ نجمة! نجمتكم من إتقانكم… مو من سبق غيركم.", rate: 0.92 }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#121a4d", "#27378a", 0.4); stars(ctx, t, 0.4);
      DUTY_ICONS.forEach(([ic, name, col], i) => { const k = ease(span(t, 0.6 + i * 0.5, 1.4 + i * 0.5)); const x = W / 2 + (i - 1.5) * 380; const y = H * 0.34 + (1 - k) * 60;
        ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.shadowColor = col; ctx.shadowBlur = 30; roundRect(ctx, x - 150, y - 130, 300, 260, 30); ctx.fill(); ctx.stroke(); ctx.restore();
        text(ctx, ic, x, y - 30, 110, { alpha: k, glow: 0.2 }); text(ctx, name, x, y + 80, 44, { alpha: k }); });
      const sel = span(t, 4.4, 5); if (sel > 0) { ctx.save(); ctx.globalAlpha = sel; ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 8; roundRect(ctx, W / 2 - 1.5 * 380 - 165, H * 0.34 - 145, 330, 290, 34); ctx.stroke(); ctx.restore(); }
      [5.4, 7].forEach((tt, j) => { const k = span(t, tt, tt + 0.4); if (k <= 0) return; const x = W / 2 - 1.5 * 380 - 90 + j * 190; text(ctx, "✔", x, H * 0.66, 100 * (1 + 0.3 * (1 - k)), { alpha: k, color: "#5fe3a1" }); text(ctx, j ? "الخميس ٢" : "الخميس ١", x, H * 0.77, 44, { alpha: k, color: "#dfe5ff", weight: 700 }); });
      if (t > 8.4) starShape(ctx, W * 0.62, H * 0.7, 70 * ease(span(t, 8.4, 9.2)), 1);
      caption(ctx, "تكليف كل خميس", t, 0.4, 4.4, H * 0.1, 64); caption(ctx, "تتقنه مرتين = نجمة لقافلتك", t, 4.8, 12, H * 0.1, 64);
      vignette(ctx, 0.45);
    } },
  { id: "recap", title: "طريقين للنجمة", dur: 9, key: 7.5, amb: "night", sfx: [[0.3, "star", 0.6], [1.6, "star", 0.6]],
    vo: [{ t: 0.4, s: "يعني… طريقين للنجمة:" }, { t: 2.2, s: "فوانيس القافلة كلها أربعة أو أكثر… أو تكليف متقن مرتين." }, { t: 6.2, s: "وكل نجمة: خطوة، ورسالة، وبطاقة!", pitch: 1.05 }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#121a4d", "#27378a", 0.4); stars(ctx, t, 0.4);
      const tile = (x, k, title, sub, draw) => { ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 4; ctx.shadowColor = "#ffcf6b"; ctx.shadowBlur = 30; roundRect(ctx, x - 380, H * 0.16, 760, 470, 34); ctx.fill(); ctx.stroke(); ctx.restore();
        starShape(ctx, x, H * 0.27, 52, k); text(ctx, title, x, H * 0.4, 58, { alpha: k }); text(ctx, sub, x, H * 0.5, 44, { alpha: k, color: "#ffe7a8", weight: 600 }); ctx.save(); ctx.globalAlpha = k; draw(x); ctx.restore(); };
      tile(W * 0.73, ease(span(t, 0.2, 1)), "نجمة الفوانيس", "كل فوانيس القافلة 4+", (x) => { for (let i = 0; i < 5; i++) lantern(ctx, x - 240 + i * 120, H * 0.6, 22, i === 2 ? 4 : 5, null, 0.8, t); });
      tile(W * 0.27, ease(span(t, 1.5, 2.3)), "نجمة التكليف", "تكليف متقن مرتين", (x) => { text(ctx, "✔ ✔", x, H * 0.6, 80, { color: "#5fe3a1" }); });
      const k = span(t, 6, 6.8); text(ctx, "كل نجمة = 👣 خطوة · 📜 رسالة · 🎴 بطاقة", W / 2, H * 0.88, 64, { alpha: k, color: "#fff" });
      vignette(ctx, 0.45);
    } },
  { id: "cards", title: "اسحب بطاقة قوة", dur: 7, key: 5, amb: "night", sfx: [[0.4, "whoosh", 0.6]],
    vo: [{ t: 0.4, s: "وكل نجمة… سحبة بطاقة قوة، تلعبونها في الملعب." }, { t: 4.6, s: "جرّبوا… اسحبوا بطاقة!", pitch: 1.05 }],
    interact: { type: "draw", q: "اضغط مسافة… واسحب بطاقة!", done: "كمّل" },
    draw(ctx, t, st) {
      sky(ctx, "#05081c", "#121a4d", "#3a1d52", 0.5); stars(ctx, t, 0.5);
      const last = st.drawn[st.drawn.length - 1];
      if (!last) { for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.12; ctx.save(); ctx.translate(W / 2 + (i - 2.5) * 70, H * 0.5 + Math.abs(i - 2.5) * 14); ctx.rotate(a + Math.sin(t * 1.5 + i) * 0.02); deckCard(ctx, 0, 0, 240, POWER_DECK[0], 0, t); ctx.restore(); } }
      else { const f = ease(span(t, last.at, last.at + 0.9)); const pop = 1 + 0.15 * Math.sin(Math.PI * span(t, last.at + 0.6, last.at + 1.1));
        st.drawn.slice(-4, -1).forEach((d, i, arr) => deckCard(ctx, W * 0.14 + i * 150, H * 0.82, 120, d.card, 1, t, 0.3));
        ctx.save(); ctx.translate(W / 2, H * 0.46); ctx.scale(pop, pop); deckCard(ctx, 0, 0, 380, last.card, f, t); ctx.restore();
        if (f >= 1) { text(ctx, last.card.name, W / 2, H * 0.07, 76, { color: "#ffd34d" }); text(ctx, last.card.rule, W / 2, H * 0.15, 48, { color: "#fff" }); } }
      caption(ctx, "كل نجمة = سحبة بطاقة قوة تلعبونها في الملعب", t, 0.4, 4.5, H * 0.1, 58);
      vignette(ctx, 0.45);
    } },
  { id: "banners", title: "القوافل الأربع", dur: 6, key: 5.5, amb: "wind", sfx: [[0.8, "flag", 0.7], [1.4, "flag", 0.6], [2, "flag", 0.6], [2.6, "flag", 0.6]],
    vo: [{ t: 0.4, s: "أربع قوافل… كل قافلة لها طريقها." }, { t: 3.8, s: "خلّونا نسمع صوتكم!", pitch: 1.1 }],
    interact: { type: "cheer", q: "كل قافلة… اسمها بأعلى صوت!", done: "كمّل" },
    draw(ctx, t, st) {
      sky(ctx, "#05081c", "#18225f", "#ef8a33", 1); const sun = ctx.createRadialGradient(W / 2, H * 0.85, 10, W / 2, H * 0.85, 600); sun.addColorStop(0, "rgba(255,200,120,.6)"); sun.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      ridge(ctx, H * 0.86, "#0f153c", 0.6, 0); dunes(ctx, H * 0.95, 18, 0, INK);
      CARAVANS.forEach((c, i) => { const k = ease(span(t, 0.8 + i * 0.6, 1.8 + i * 0.6)); if (k <= 0) return; const on = st.cheer.has(i); const pulse = on ? 1 + 0.06 * Math.sin(t * 8) : 1;
        const x = W * (0.84 - i * 0.227); const y = 70 + k * 260 + 230; const wv = Math.sin(t * 2.4 + i) * (on ? 20 : 8);
        ctx.save(); ctx.strokeStyle = "rgba(220,200,160,.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 80, 0); ctx.lineTo(x - 80, y - 260); ctx.moveTo(x + 80, 0); ctx.lineTo(x + 80, y - 260); ctx.stroke();
        ctx.translate(x, y - 130); ctx.scale(pulse, pulse); ctx.translate(-x, -(y - 130));
        const g = ctx.createLinearGradient(x - 100, 0, x + 100, 0); g.addColorStop(0, mixHex(c.color, "#000000", 0.3)); g.addColorStop(0.5, c.color); g.addColorStop(1, mixHex(c.color, "#000000", 0.3));
        ctx.fillStyle = g; ctx.shadowColor = c.color; ctx.shadowBlur = on ? 90 : 25; ctx.beginPath(); ctx.moveTo(x - 100, y - 260); ctx.lineTo(x + 100, y - 260); ctx.quadraticCurveTo(x + 100 + wv, y - 120, x + 100, y); ctx.lineTo(x, y - 40); ctx.lineTo(x - 100, y); ctx.quadraticCurveTo(x - 100 + wv, y - 120, x - 100, y - 260); ctx.closePath(); ctx.fill(); ctx.restore();
        text(ctx, c.name, x, y - 150, 54);
        const lv = st.level ? st.level[i] || 0 : 0; if (lv > 0) { ctx.save(); ctx.fillStyle = "rgba(255,255,255,.12)"; roundRect(ctx, x - 90, y + 30, 180, 22, 11); ctx.fill(); ctx.fillStyle = c.color; ctx.shadowColor = c.color; ctx.shadowBlur = 20; roundRect(ctx, x - 90, y + 30, 180 * Math.min(1, lv), 22, 11); ctx.fill(); ctx.restore(); }
        if (on) for (let q = 0; q < 14; q++) { const a = q * 0.45 + t * 2; ctx.fillStyle = c.color; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (140 + (t * 60) % 80), y - 130 + Math.sin(a) * 180, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } });
      caption(ctx, "أربع قوافل… كل قافلة لها طريقها", t, 0.4, 3.7, H * 0.84, 60);
      vignette(ctx, 0.4);
    } },
  { id: "reveal", title: "الكشف", dur: 14, key: 9.5, amb: "wind", sfx: [[2.4, "reveal", 1]],
    vo: [{ t: 0.4, s: "الحادي… مو أنا.", pitch: 0.85, rate: 0.8 }, { t: 6, s: "كل خميس… واحد منكم.", pitch: 0.85, rate: 0.85 }, { t: 9.6, s: "يمكن تكون أنت… اللي يجمع قافلته.", pitch: 0.85, rate: 0.85 }],
    draw(ctx, t) {
      sky(ctx, "#05081c", "#18225f", "#ef8a33", 0.9); const sun = ctx.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, 600); sun.addColorStop(0, `rgba(255,214,140,${0.5 + 0.4 * span(t, 2.4, 6)})`); sun.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      dunes(ctx, H * 0.92, 20, 0, INK);
      const m = ease(span(t, 2.4, 5.4));
      ctx.save(); ctx.globalAlpha = 1 - m; hadi(ctx, W / 2, H * 0.92, 1.3, t, INK, 1 - span(t, 1, 3), 0.6); ctx.restore();
      const fall = span(t, 1, 3.5); if (fall > 0) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = INK; ctx.translate(W / 2 - 60 * fall, H * 0.92 - 470 * (1 - ease(fall)) - 10); ctx.rotate(fall * 1.2); ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.globalAlpha = m; boy(ctx, W / 2, H * 0.92, 1.5, INK, t); ctx.restore();
      if (m > 0.6) { const f = rng(5); ctx.save(); for (let i = 0; i < 60; i++) { ctx.globalAlpha = (m - 0.6) * 2 * f(); ctx.fillStyle = GLOW; ctx.beginPath(); ctx.arc(W / 2 + (f() - 0.5) * 500, H * 0.92 - f() * 600 - (t - 4) * 20 * f(), 2 + f() * 3, 0, 7); ctx.fill(); } ctx.restore(); }
      caption(ctx, "الحادي… مو أنا.", t, 0.4, 3.6, H * 0.14, 78); caption(ctx, "كل خميس… واحد منكم.", t, 6, 9.5, H * 0.14, 78); caption(ctx, "يمكن تكون أنت… اللي يجمع قافلته.", t, 9.6, 14, H * 0.14, 72);
      vignette(ctx, 0.45);
    } },
  { id: "end", title: "النهاية", dur: 11, key: 8, amb: "night", sfx: [[0.2, "whoosh", 0.6], [5, "reveal", 0.6]],
    vo: [{ t: 0.6, s: "الخميس، الساعة خمسة." }, { t: 2.6, s: "أول نجمة… أول خطوة… أول رسالة." }, { t: 6.4, s: "أتحدّى… وأتعاون.", rate: 0.85 }],
    draw(ctx, t, st, img) {
      ctx.fillStyle = "#060918"; ctx.fillRect(0, 0, W, H); stars(ctx, t, 0.7);
      text(ctx, "الخميس · 5:00", W / 2, H * 0.22, 110, { alpha: fadeIO(t, 0.5, 11, 0.8), color: GLOW });
      text(ctx, "أول نجمة… أول خطوة… أول رسالة", W / 2, H * 0.36, 64, { alpha: fadeIO(t, 2.5, 11, 0.8) });
      const k = span(t, 5, 6.5); if (img && img.complete && img.naturalWidth) { ctx.save(); ctx.globalAlpha = k; const w = 620, h = w * img.naturalHeight / img.naturalWidth; ctx.drawImage(img, W / 2 - w / 2, H * 0.6 - h / 2, w, h); ctx.restore(); }
      text(ctx, "أتحدى وأتعاون", W / 2, H * 0.84, 64, { alpha: k, color: "#ffe7a8", weight: 600 });
      ctx.save(); dunes(ctx, H * 0.97, 14, 0, "#0b1030"); ctx.fillStyle = "#141c4c"; const cx = W + 200 - t * 70; for (let i = 0; i < 5; i++) camel(ctx, cx + i * 70, H * 0.955, 0.32, t + i); ctx.restore();
    } },
];
/** linear order (branches are reached from choices) */
export const ORDER = ["storm", "hadi", "order", "lantern", "star", "problem", "fazaa", "you", "duty", "recap", "cards", "banners", "reveal", "end"];
export const SEG = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));
export const LINEAR_DURATION = ORDER.reduce((n, id) => n + SEG[id].dur, 0);
export function drawSeg(ctx, id, t, st, img) {
  const s = SEG[id]; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; s.draw(ctx, t, st || { drawn: [], cheer: new Set() }, img); ctx.restore();
  const edge = Math.min(t, s.interact ? 99 : s.dur - t); if (edge < 0.3) { ctx.fillStyle = `rgba(0,0,0,${1 - edge / 0.3})`; ctx.fillRect(0, 0, W, H); }
}
