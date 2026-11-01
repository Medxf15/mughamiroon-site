import { W, H, SEGMENTS, SEG, ORDER, LINEAR_DURATION, drawSeg, POWER_DECK, ALL_LINES } from "./film.js";
import { storage } from "./api.js";
const root = document.getElementById("root");
const logo = new Image(); logo.src = "assets/mahara.png";
const q = new URLSearchParams(location.search);
await document.fonts.load('700 60px "Readex Pro"').catch(() => {}); await document.fonts.ready;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const CAR_NAMES = ["أُحد", "القبلتين", "قُباء", "العقيق"];
const ITYPE = { choice: "🗳️ قرار: القافلة تكمل أو ترجع", draw: "🎴 سحب بطاقة مباشر", cheer: "📣 هتاف القوافل" };

if (q.has("board")) {
  let acc = 0;
  root.innerHTML = `<div class="board"><div class="bar"><a href="film.html">▶︎ تشغيل الفيلم</a><a href="index.html#admin">→ المنصة</a></div>
    <h1>طريق الحادي · الحلقة صفر — لوحة المشاهد</h1><details class="guide" open><summary>دليل العرض للمشرف</summary><ol>
      <li>قبل العرض: اضغط «🔊 جرّب الصوت أول» وارفع صوت التلفاز. للصوت الأوضح افتحه في Microsoft Edge.</li>
      <li>قبل سؤال القافلة قل: «هذا فانوس… مو أحد فينا». خلّ كل قافلة تتشاور 10 ثواني وتصوّت كفريق.</li>
      <li>سحب البطاقة: مسافة = سحبة، ونخليها 2–3 سحبات بس، ثم Enter.</li>
      <li>الهتاف: اضغط «🎤 شغّل عدّاد الصوت» مرة (يطلب إذن المايك، ولا يسجّل شي)، ثم اضغط رقم القافلة وخلّهم يهتفون 3 ثواني.</li>
      <li>بعد الفيلم مباشرة (دقيقتين): «خطة فزعتنا» — كل قافلة تكتب: «لو واحد منا نوره ضعف، نسوي له…» ويقرأها القائد في الختام.</li>
      <li>وضّح شفهيًا: الفزعة مرة وحدة لكل قافلة في اللقاء.</li></ol></details><p class="sub">${ORDER.length} مقطع + فرع «تكمل بدونه» · قرابة ${fmt(LINEAR_DURATION)} بدون وقت التفاعل.</p>
    <div class="grid">${[...ORDER.slice(0, 6), "leave", ...ORDER.slice(6)].map((id, i) => { const s = SEG[id]; const from = id === "leave" ? null : acc; if (id !== "leave") acc += s.dur;
      return `<article class="sc"><canvas width="${W}" height="${H}" data-id="${id}"></canvas><div><small>${id === "leave" ? "فرع: لو اختاروا «تكمل بدونه»" : `المقطع · <bdi dir="ltr">${fmt(from)}</bdi>`}${s.interact ? ` · <b>${ITYPE[s.interact.type]}</b>` : ""}</small><h2>${s.title}</h2><p>${s.vo.map((v) => v.s).join(" ")}</p></div></article>`; }).join("")}</div></div>`;
  const demo = { drawn: [{ card: POWER_DECK[0], at: 0 }], cheer: new Set([0, 2]) };
  const draw = () => document.querySelectorAll("canvas[data-id]").forEach((c) => { const s = SEG[c.dataset.id]; drawSeg(c.getContext("2d"), s.id, s.key, s.id === "cards" ? demo : s.id === "banners" ? demo : undefined, logo); });
  draw(); logo.onload = draw;
} else {
  root.innerHTML = `<div class="stage"><canvas width="${W}" height="${H}"></canvas><div id="ia" class="ia" hidden></div></div>
    <div class="start" id="start"><div><i id="go">▶︎</i><b>طريق الحادي</b><span>الحلقة صفر · فيلم تفاعلي</span>
      <p id="vstat" class="vstat"></p><button id="test" class="testbtn">🔊 جرّب الصوت أول</button><p class="keys">💡 شغّل الفيلم من متصفح Chrome أو Edge على اللابتوب المتصل بالتلفاز، وتأكد إن صوت ويندوز والتلفاز مرفوع.</p>
      <p class="keys">مسافة = تشغيل/التالي · 1 و2 = الاختيار · 1–4 = هتاف القوافل · ← → = المقطع التالي/السابق</p></div></div>
    <div class="hud"><button id="pp">⏸</button><button id="prev">⏮</button><button id="next">⏭</button><span id="seg"></span><button id="fs">⛶</button><a href="film.html?board">لوحة المشاهد</a></div>`;
  const cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), ia = document.getElementById("ia");
  const audio = makeAudio(), narr = makeNarrator();
  const st = { drawn: [], cheer: new Set(), level: [0, 0, 0, 0] }; const mic = makeMic();
  let segId = ORDER[0], t = 0, last = null, playing = false, waiting = false, fired = new Set(), spoke = new Set();
  const recs = storage.list("film-voice").then((xs) => new Set((xs || []).map((x) => x.name.replace(/\.\w+$/, "")))).catch(() => new Set());
  Promise.all([narr.ready, recs]).then(([v, have]) => { const n = ALL_LINES.filter((l) => have.has(l.id)).length; const el = document.getElementById("vstat"); if (!el) return;
    if (n) { el.textContent = `🎙️ التعليق الصوتي المسجّل: ${n} من ${ALL_LINES.length} جملة${n < ALL_LINES.length ? " (الباقي بصوت الجهاز)" : " ✓"}`; return; }
    el.innerHTML = (v ? `🎙️ ما فيه تسجيل صوتي بعد، الراوي بصوت الجهاز (${v.name}).` : "🔇 ما فيه تسجيل صوتي ولا صوت عربي في الجهاز.") + ` <a href="index.html#studio">سجّل التعليق من الاستوديو</a>`; });
  narr.ready.then((v) => { const el = null; if (el) el.textContent = v ? (v.natural ? `🎙️ صوت الراوي: ${v.name} (طبيعي)` : `🎙️ صوت الراوي: ${v.name} — للصوت الأوضح افتح الفيلم في Microsoft Edge`) : "🔇 ما فيه صوت عربي للراوي في هذا الجهاز: المؤثرات تشتغل، والكلام يظهر نصًّا"; });

  function enter(id) {
    segId = id; t = 0; waiting = false; fired = new Set(); spoke = new Set(); narr.stop(); audio.stopVoice(); ia.hidden = true; ia.innerHTML = "";
    audio.ambience(SEG[id].amb); document.getElementById("seg").textContent = SEG[id].title;
  }
  function nextLinear() { const i = ORDER.indexOf(segId); if (segId === "leave") return; if (i >= 0 && i < ORDER.length - 1) enter(ORDER[i + 1]); else { playing = false; audio.ambience(null); } }
  function finish() {
    const s = SEG[segId];
    if (!s.interact) return nextLinear();
    waiting = true; const it = s.interact;
    if (it.type === "choice") ia.innerHTML = `<p class="ia-q">${it.q}</p><div class="ia-opts">${it.opts.map((o, i) => `<button data-c="${i}"><b>${i + 1}</b>${o[0]} ${o[1]}</button>`).join("")}</div>`;
    else if (it.type === "draw") ia.innerHTML = `<p class="ia-q">${it.q}</p><div class="ia-opts"><button data-draw="1"><b>مسافة</b>🎴 اسحب</button><button data-done="1"><b>Enter</b>${it.done} ▶︎</button></div>`;
    else if (it.type === "cheer") ia.innerHTML = `<p class="ia-q">${it.q}</p><div class="ia-opts">${CAR_NAMES.map((n, i) => `<button data-cheer="${i}"><b>${i + 1}</b>📣 ${n}</button>`).join("")}<button data-mic="1" id="micbtn">${mic.on ? "🎤 عدّاد الصوت شغّال" : "🎤 شغّل عدّاد الصوت"}</button><button data-done="1"><b>Enter</b>${it.done} ▶︎</button></div>`;
    ia.hidden = false; audio.play("tick", 0.6);
  }
  function choose(i) { const s = SEG[segId]; if (!waiting || s.interact.type !== "choice") return; audio.play("whoosh", 0.6); enter(s.interact.next[i]); }
  function drawCard() { if (!waiting || SEG[segId].interact.type !== "draw") return; const card = POWER_DECK[Math.floor(Math.random() * POWER_DECK.length)]; st.drawn.push({ card, at: t });
    audio.play("flip", 1); setTimeout(() => audio.play(card.tier === "أسطورية" ? "reveal" : "star", card.tier === "أسطورية" ? 0.9 : 0.6), 700); setTimeout(() => say(card.name + "!", { id: "card-" + card.k, rate: 0.95, pitch: 1.05 }), 1000); }
  function cheer(i) { if (!waiting || SEG[segId].interact.type !== "cheer") return; audio.play("beat", 0.8); audio.play("flag", 0.6);
    if (mic.on) { st.level[i] = 0; st.cheer.delete(i); mic.listen(3500, (lv) => { st.level[i] = Math.max(st.level[i], lv); if (st.level[i] > 0.35) st.cheer.add(i); }); }
    else { st.cheer.has(i) ? st.cheer.delete(i) : st.cheer.add(i); st.level[i] = st.cheer.has(i) ? 1 : 0; } }
  function done() { if (waiting && (SEG[segId].interact.type === "draw" || SEG[segId].interact.type === "cheer")) { waiting = false; nextLinear(); } }
  ia.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.c) choose(+b.dataset.c); if (b.dataset.draw) drawCard(); if (b.dataset.cheer) cheer(+b.dataset.cheer); if (b.dataset.done) done(); if (b.dataset.mic) mic.enable().then((ok) => { b.textContent = ok ? "🎤 عدّاد الصوت شغّال" : "🎤 ما توفر المايك"; }); };

  function frame(now) {
    if (playing) { const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000); t += dt; }
    last = now; const s = SEG[segId];
    if (playing && !waiting) {
      for (const [at, name, vol] of s.sfx || []) { const k = at + name; if (t >= at && !fired.has(k)) { fired.add(k); name === "steps" ? audio.steps(s.dur - at) : audio.play(name, vol ?? 0.8); } }
      const busy = audio.voiceBusy() || narr.busy();
      if (!busy) { const i = s.vo.findIndex((v, k) => !spoke.has(k) && t >= v.t); if (i >= 0) { spoke.add(i); say(s.vo[i].s, s.vo[i]); } }
      const pending = s.vo.some((v, k) => !spoke.has(k));
      if (t >= s.dur && !busy && !pending) { if (s.interact) { t = s.dur; finish(); } else nextLinear(); }
    }
    drawSeg(ctx, segId, waiting || SEG[segId].interact ? t : Math.min(t, SEG[segId].dur - 0.32), st, logo); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  async function start() { document.getElementById("start")?.remove(); try { await document.documentElement.requestFullscreen(); } catch (x) {} await audio.start(); await audio.loadVoices(await recs); playing = true; enter(ORDER[0]); }
  const say = (text, cue) => { if (cue && cue.id && audio.playVoice(cue.id)) return; narr.say(text, cue || {}); };
  document.getElementById("go").onclick = start; document.getElementById("start").onclick = (e) => { if (e.target.id !== "test") start(); };
  document.getElementById("test").onclick = async (e) => { e.stopPropagation(); await audio.start(); await audio.loadVoices(await recs); audio.play("reveal", 0.9); say("جاهزين؟", { id: "end-3", rate: 0.95 }); };
  document.getElementById("pp").onclick = () => { playing = !playing; if (!playing) narr.stop(); audio.mute(!playing); document.getElementById("pp").textContent = playing ? "⏸" : "▶︎"; };
  document.getElementById("next").onclick = () => { const i = ORDER.indexOf(segId); enter(ORDER[Math.min(ORDER.length - 1, (i < 0 ? ORDER.indexOf("fazaa") - 1 : i) + 1)]); };
  document.getElementById("prev").onclick = () => { const i = ORDER.indexOf(segId); enter(ORDER[Math.max(0, (i < 0 ? ORDER.indexOf("problem") + 1 : i) - 1)]); };
  document.getElementById("fs").onclick = () => document.documentElement.requestFullscreen?.();
  addEventListener("keydown", (e) => {
    if (document.getElementById("start")) { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); start(); } return; }
    const ty = waiting ? SEG[segId].interact.type : null;
    if (e.code === "Space") { e.preventDefault(); if (ty === "draw") drawCard(); else if (!waiting) document.getElementById("pp").click(); }
    if (e.code === "Enter") { e.preventDefault(); done(); }
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
    if (n != null) { if (ty === "choice" && n < 2) choose(n); if (ty === "cheer") cheer(n); }
    if (e.code === "ArrowLeft") document.getElementById("next").click(); if (e.code === "ArrowRight") document.getElementById("prev").click();
  });
}

/** sound effects from files (natural sounds only) */
function makeAudio() {
  const NAMES = ["storm", "wind", "step", "beat", "whoosh", "ignite", "shimmer", "star", "break", "flip", "reveal", "wax", "paper", "flag", "tick", "swell"];
  let ac, master, buf = {}, amb = null, ambGain = null, started = false, stepsTimer = null;
  const load = async (n) => { try { const r = await fetch(`assets/film/${n}.mp3`); buf[n] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { console.warn("sound", n, e); } };
  return {
    async start() { if (started) { if (ac.state !== "running") await ac.resume(); return; } started = true; ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination); await ac.resume(); await Promise.all(NAMES.map(load)); },
    play(n, vol = 0.8) { if (!ac || !buf[n]) return; const s = ac.createBufferSource(); s.buffer = buf[n]; const g = ac.createGain(); g.gain.value = vol; s.connect(g).connect(master); s.start(); },
    ambience(kind) { if (!ac) return; if (stepsTimer) { clearInterval(stepsTimer); stepsTimer = null; }
      const target = kind === "wind" ? 0.45 : kind === "night" ? 0.14 : kind === "storm" ? 0.2 : 0;
      if (!amb && buf.wind) { amb = ac.createBufferSource(); amb.buffer = buf.wind; amb.loop = true; ambGain = ac.createGain(); ambGain.gain.value = 0; amb.connect(ambGain).connect(master); amb.start(); }
      this._amb = target; if (ambGain) ambGain.gain.setTargetAtTime(target, ac.currentTime, 0.6); },
    steps(dur) { if (stepsTimer) clearInterval(stepsTimer); const end = Date.now() + dur * 1000; stepsTimer = setInterval(() => { if (Date.now() > end) { clearInterval(stepsTimer); stepsTimer = null; return; } this.play("step", 0.5); }, 620); },
    mute(m) { if (master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.1); },
    async loadVoices(ids) { if (!ac || this._vloaded) return; this._vloaded = true; this.vbuf = {};
      await Promise.all([...ids].map(async (id) => { try { const r = await fetch(storage.publicUrl("film-voice", id + ".wav") + "?v=" + Date.now()); if (r.ok) this.vbuf[id] = await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { console.warn("voice", id, e); } })); },
    playVoice(id) { if (!ac || !this.vbuf || !this.vbuf[id]) return false; this.stopVoice(); const s = ac.createBufferSource(); s.buffer = this.vbuf[id]; const g = ac.createGain(); g.gain.value = 1.6; s.connect(g).connect(master); s.start(); this._vsrc = s; this._vend = ac.currentTime + s.buffer.duration + 0.25;
      if (ambGain) { ambGain.gain.setTargetAtTime(0.06, ac.currentTime, 0.15); setTimeout(() => ambGain && ambGain.gain.setTargetAtTime(this._amb || 0.14, ac.currentTime, 0.5), s.buffer.duration * 1000); } return true; },
    stopVoice() { try { this._vsrc && this._vsrc.stop(); } catch (e) {} this._vsrc = null; this._vend = 0; },
    voiceBusy() { return !!(ac && this._vend && ac.currentTime < this._vend); },
  };
}

/** narration with the best Arabic voice on this device */
function makeNarrator() {
  const synth = window.speechSynthesis; let voice = null;
  const pick = () => { const vs = synth ? synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("ar")) : [];
    const score = (v) => (/natural|online|neural/i.test(v.name) ? 10 : 0) + (/hamed|naayf|maged|shakir|hamdan/i.test(v.name) ? 3 : 0) + (/sa/i.test(v.lang) ? 2 : 0);
    vs.sort((a, b) => score(b) - score(a)); voice = vs[0] || null; return voice ? { name: voice.name.replace(/^Microsoft /, "").replace(/ - .*/, ""), natural: /natural|online|neural/i.test(voice.name) } : null; };
  const ready = new Promise((res) => { if (!synth) return res(null); const r0 = pick(); if (r0) return res(r0); synth.onvoiceschanged = () => res(pick()); setTimeout(() => res(pick()), 2500); });
  return {
    ready,
    say(text, o = {}) { if (!synth || !voice) return; const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = o.rate || 0.9; u.pitch = o.pitch || 0.95; u.volume = 1;
      if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(() => synth.speak(u), 60); } else synth.speak(u); },
    stop() { if (synth && (synth.speaking || synth.pending)) synth.cancel(); },
    busy() { return !!(synth && voice && (synth.speaking || synth.pending)); },
  };
}

/** loudness meter from the laptop microphone: nothing is recorded or sent anywhere */
function makeMic() {
  let ac, an, data, on = false;
  return {
    get on() { return on; },
    async enable() { if (on) return true; try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaStreamSource(stream); an = ac.createAnalyser(); an.fftSize = 1024; data = new Float32Array(an.fftSize); src.connect(an); on = true; return true; } catch (e) { console.warn("mic", e); return false; } },
    listen(ms, cb) { if (!on) return; const end = performance.now() + ms; const tick = () => { an.getFloatTimeDomainData(data); let sum = 0; for (const v of data) sum += v * v; const rms = Math.sqrt(sum / data.length); cb(Math.max(0, Math.min(1, (rms - 0.02) / 0.22))); if (performance.now() < end) requestAnimationFrame(tick); }; tick(); },
  };
}
