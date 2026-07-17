// Audio manager: music crossfades via two <audio> elements + WebAudio synth stingers.
// Everything starts only after the first user tap (iOS requirement).
// iPad Safari ignores HTMLMediaElement.volume, so each player is routed through a
// WebAudio GainNode at unlock time; volume changes go through the gain when available.
window.AudioMan = (function () {
  const TRACKS = {
    intro: "assets/audio/intro.mp3",
    question: "assets/audio/question.mp3",
    finale: "assets/audio/finale.mp3",
    slideshows: [
      "assets/audio/slideshow1.mp3",
      "assets/audio/slideshow2.mp3",
      "assets/audio/slideshow3.mp3",
      "assets/audio/slideshow4.mp3",
    ],
  };
  const MUSIC_VOL = { intro: 0.55, question: 0.28, slideshow: 0.75, finale: 0.85 };

  let ctx = null;
  let unlocked = false;
  let muted = false;
  let current = null; // {el, src, key, targetVol}
  let fadeTimer = null;
  const players = [new Audio(), new Audio()];
  players.forEach((p) => { p.loop = true; p.preload = "auto"; });
  let flip = 0;

  function setVol(p, v) {
    if (p._gain) p._gain.gain.value = v;
    else p.volume = v;
  }
  function getVol(p) {
    return p._gain ? p._gain.gain.value : p.volume;
  }

  // 0.1s of silence — used to "bless" both <audio> elements inside the first
  // user gesture so iOS Safari allows programmatic play() on them later.
  const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { ctx = null; }
    players.forEach((p) => {
      if (ctx) {
        try {
          const srcNode = ctx.createMediaElementSource(p);
          const gain = ctx.createGain();
          srcNode.connect(gain).connect(ctx.destination);
          p._gain = gain;
        } catch (e) { /* fall back to el.volume */ }
      }
      p.src = SILENCE;
      const pr = p.play();
      if (pr && pr.catch) pr.catch(() => {});
    });
  }

  // Heal audio after iOS interruptions (app switch, screen lock, Siri...).
  function resume() {
    if (ctx && ctx.state !== "running") { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); }
    if (unlocked && current && current.el.paused) {
      const p = current.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function crossfadeTo(src, key, targetVol, seconds) {
    if (!unlocked) return;
    if (current && current.src === src) return;
    const dur = (seconds || 1.6) * 1000;
    const prev = current;
    const prevFrom = prev ? getVol(prev.el) : 0;
    const el = players[flip = 1 - flip];
    el.src = src;
    setVol(el, 0);
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    current = { el, src, key, targetVol };
    if (fadeTimer) clearInterval(fadeTimer);
    const t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      setVol(el, muted ? 0 : targetVol * k);
      if (prev) setVol(prev.el, Math.max(0, (muted ? 0 : prevFrom) * (1 - k)));
      if (k >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        if (prev) { prev.el.pause(); prev.el.src = ""; }
      }
    }, 50);
  }

  // ---- synth stingers (no files needed) ----
  function tone(freq, t0, dur, type, vol, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(dest || ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function playCorrect() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    // bright ascending major arpeggio + sparkle
    [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.28]].forEach(([f, d]) =>
      tone(f, t + d, 0.5, "triangle", 0.22));
    [[2093, 0.34], [2637, 0.42]].forEach(([f, d]) => tone(f, t + d, 0.3, "sine", 0.08));
  }

  function playWrong() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    // gentle "oops" — soft, not scary
    tone(392, t, 0.25, "triangle", 0.16);
    tone(311.13, t + 0.18, 0.4, "triangle", 0.14);
  }

  function playDrumroll(durSec) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const n = Math.floor(durSec * 22);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * durSec;
      const len = 0.03;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.05 + 0.09 * (i / n); // crescendo
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    }
  }

  function playTap() {
    if (!ctx || muted) return;
    tone(880, ctx.currentTime, 0.08, "sine", 0.1);
  }

  function playFanfare() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], [1318.5, 0.52], [1567.98, 0.68]]
      .forEach(([f, d]) => tone(f, t + d, 0.7, "triangle", 0.2));
  }

  function setMuted(m) {
    muted = m;
    players.forEach((p) => { p.muted = m; }); // iOS honors .muted even when it ignores .volume
    if (current) setVol(current.el, m ? 0 : current.targetVol);
  }

  // Warm the HTTP cache for all tracks so music never arrives late on home WiFi.
  function preload() {
    const list = [TRACKS.question, ...TRACKS.slideshows, TRACKS.finale];
    list.forEach((src, i) => setTimeout(() => {
      const a = new Audio();
      a.preload = "auto";
      a.src = src;
      a.load();
    }, 1500 * (i + 1)));
  }

  return {
    unlock, resume, preload,
    intro: () => crossfadeTo(TRACKS.intro, "intro", MUSIC_VOL.intro, 2),
    question: () => crossfadeTo(TRACKS.question, "question", MUSIC_VOL.question, 1.8),
    slideshow: (qIndex) =>
      crossfadeTo(TRACKS.slideshows[qIndex % TRACKS.slideshows.length], "slideshow", MUSIC_VOL.slideshow, 1.4),
    finale: () => crossfadeTo(TRACKS.finale, "finale", MUSIC_VOL.finale, 2.5),
    duck: (v) => { if (current) setVol(current.el, muted ? 0 : v); },
    playCorrect, playWrong, playDrumroll, playTap, playFanfare,
    setMuted,
    isMuted: () => muted,
  };
})();
