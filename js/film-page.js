import { W, H, SCENES, DURATION, drawAt, VO_REAL as VO, toReal } from "./film.js";
const root = document.getElementById("root");
const logo = new Image(); logo.src = "assets/mahara.png";
const q = new URLSearchParams(location.search);
await document.fonts.load('700 60px "Readex Pro"').catch(() => {}); await document.fonts.ready;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

if (q.has("board")) {
  root.innerHTML = `<div class="board"><div class="bar"><a href="film.html">▶︎ تشغيل الفيلم</a><a href="index.html#home">→ المنصة</a></div>
    <h1>طريق الحادي · الحلقة صفر — لوحة المشاهد</h1><p class="sub">${SCENES.length} مشاهد · ${fmt(DURATION)} · كل صورة هي لقطة من المشهد عند لحظته الأهم.</p>
    <div class="grid">${SCENES.map((s, i) => `<article class="sc"><canvas width="${W}" height="${H}" data-i="${i}"></canvas><div><small>المشهد ${i + 1} · <bdi dir="ltr">${fmt(toReal(s.a))}–${fmt(toReal(s.b))}</bdi></small><h2>${s.title}</h2><p>${s.vo}</p></div></article>`).join("")}</div></div>`;
  const draw = () => document.querySelectorAll("canvas[data-i]").forEach((c) => drawAt(c.getContext("2d"), toReal(SCENES[+c.dataset.i].key), logo));
  draw(); logo.onload = draw;
} else {
  root.innerHTML = `<div class="stage"><canvas width="${W}" height="${H}"></canvas></div>
    <div class="start" id="start"><div><i>▶︎</i><b>طريق الحادي</b><span>الحلقة صفر · اضغط للتشغيل بملء الشاشة</span><p id="vstat" class="vstat"></p></div></div>
    <div class="hud"><button id="pp">⏸</button><input id="seek" type="range" min="0" max="${DURATION}" step="0.1" value="0"><span id="tm">0:00</span><button id="fs">⛶</button><a href="film.html?board">لوحة المشاهد</a></div>`;
  const cv = root.querySelector("canvas"), ctx = cv.getContext("2d");
  let t0 = null, t = Number(q.get("t") || 0), playing = false;
  const audio = makeAudio(); const narr = makeNarrator();
  narr.ready.then((v) => { const el = document.getElementById("vstat"); if (!el) return; el.textContent = v ? (v.natural ? `🎙️ الصوت: ${v.name} (طبيعي)` : `🎙️ الصوت: ${v.name} — للصوت الأوضح افتح الفيلم في متصفح Microsoft Edge`) : "🔇 ما فيه صوت عربي في هذا الجهاز، الفيلم يشتغل بالنصوص فقط"; });
  function frame(now) { if (playing) { if (t0 == null) t0 = now - t * 1000; t = (now - t0) / 1000; if (t >= DURATION) { t = DURATION - 0.01; playing = false; } }
    drawAt(ctx, t, logo); audio.update(t, playing); narr.update(t, playing); document.getElementById("seek").value = t; document.getElementById("tm").textContent = fmt(t); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  document.getElementById("start").onclick = async (e) => { e.currentTarget.remove(); try { await document.documentElement.requestFullscreen(); } catch (x) {} await audio.start(); playing = true; t0 = null; };
  document.getElementById("pp").onclick = () => { playing = !playing; t0 = null; document.getElementById("pp").textContent = playing ? "⏸" : "▶︎"; };
  document.getElementById("seek").oninput = (e) => { t = +e.target.value; t0 = null; narr.seek(t); };
  document.getElementById("fs").onclick = () => document.documentElement.requestFullscreen?.();
  addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); document.getElementById("pp").click(); } if (e.code === "ArrowLeft") { t = Math.min(DURATION, t + 5); t0 = null; narr.seek(t); } if (e.code === "ArrowRight") { t = Math.max(0, t - 5); t0 = null; narr.seek(t); } });
}

/** natural sounds only: wind and camel footfalls (no instruments). A recorded hida/voice file plays if present. */
function makeAudio() {
  let ac, wind, windGain, master, voice, lastStep = -1, lastBeat = -1;
  return {
    async start() {
      ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      wind = ac.createBufferSource(); wind.buffer = buf; wind.loop = true; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 0.6;
      windGain = ac.createGain(); windGain.gain.value = 0; wind.connect(f).connect(windGain).connect(master); wind.start();
      try { const r = await fetch("assets/film/voice.mp3", { method: "HEAD" }); if (r.ok) { voice = new Audio("assets/film/voice.mp3"); } } catch (e) {}
    },
    update(t, playing) {
      if (!ac) return; const storm = t < 5 ? 1 : t < 12 ? 0.08 : 0.25; windGain.gain.setTargetAtTime(playing ? storm * 0.9 : 0, ac.currentTime, 0.3);
      if (voice) { if (playing && voice.paused) { voice.currentTime = t; voice.play().catch(() => {}); } if (!playing && !voice.paused) voice.pause(); if (Math.abs(voice.currentTime - t) > 0.4) voice.currentTime = t; }
      const beats = [14, 16.5, 19, 21.5].map(toReal); const bi = beats.findIndex((b) => t >= b && t < b + 0.12);
      if (playing && bi >= 0 && lastBeat !== bi) { lastBeat = bi; const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(90, ac.currentTime); o.frequency.exponentialRampToValueAtTime(38, ac.currentTime + 0.35); g.gain.setValueAtTime(0.6, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.45); o.connect(g).connect(master); o.start(); o.stop(ac.currentTime + 0.5); }
      const walking = (t > toReal(23) && t < toReal(40)) || (t > toReal(47) && t < toReal(54.4)); const step = Math.floor(t / 0.62);
      if (playing && walking && step !== lastStep) { lastStep = step; const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(70, ac.currentTime); o.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.18); g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22); o.connect(g).connect(master); o.start(); o.stop(ac.currentTime + 0.25); }
    },
  };
}

/** speaks the narration with the best Arabic voice on this device; a recorded voice.mp3 takes over when present */
function makeNarrator() {
  const synth = window.speechSynthesis; let voice = null, last = -1, recorded = false;
  const pick = () => { const vs = synth ? synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("ar")) : [];
    const score = (v) => (/natural|online|neural/i.test(v.name) ? 10 : 0) + (/hamed|naayf|maged|shakir|hamdan/i.test(v.name) ? 3 : 0) + (/sa/i.test(v.lang) ? 2 : 0);
    vs.sort((a, b) => score(b) - score(a)); voice = vs[0] || null; return voice ? { name: voice.name.replace(/^Microsoft /, "").replace(/ - .*/, ""), natural: /natural|online|neural/i.test(voice.name) } : null; };
  const ready = new Promise((res) => { fetch("assets/film/voice.mp3", { method: "HEAD" }).then((r) => { recorded = r.ok; }).catch(() => {}).finally(() => {
    if (!synth) return res(null); const r0 = pick(); if (r0) return res(r0); synth.onvoiceschanged = () => res(pick()); setTimeout(() => res(pick()), 2500); }); });
  return {
    ready,
    seek(t) { if (synth) synth.cancel(); last = VO.findIndex((c) => c.t >= t) - 1; },
    update(t, playing) {
      if (!synth || recorded || !voice) return;
      if (!playing) { if (synth.speaking) synth.cancel(); return; }
      const i = VO.findIndex((c, k) => k > last && c.t <= t && t - c.t < 1.5);
      if (i >= 0) { last = i; const c = VO[i]; const u = new SpeechSynthesisUtterance(c.s); u.voice = voice; u.lang = voice.lang; u.rate = c.rate || 0.9; u.pitch = c.pitch || 0.95; synth.cancel(); synth.speak(u); }
    },
  };
}
