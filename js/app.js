// 13 שנים של אהבה — quiz state machine
(function () {
  const $ = (sel) => document.querySelector(sel);
  const LETTERS = ["א", "ב", "ג", "ד"];
  const SHAPES = ["♥", "★", "◆", "✿"];
  const SLIDE_MS = 5500;

  let qIndex = 0;
  let phase = "intro"; // intro | ready | question | reveal | slideshow | montage | end
  let slideTimer = null;
  let slideIdx = 0;
  let currentPhotos = [];
  let slideTapGuardUntil = 0;
  let answerGuardUntil = 0;
  let revealGuardUntil = Infinity;
  let endGuardUntil = 0;
  let revealTimer = null;
  let wakeLock = null;

  // ---------- helpers ----------
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  const preloaded = new Set();
  function preloadFolder(key) {
    if (preloaded.has(key)) return;
    preloaded.add(key);
    (window.PHOTOS[key] || []).forEach((p) => { const im = new Image(); im.src = p.src; });
  }

  // After the first tap, quietly warm the cache for the whole quiz in play order
  // so slideshows never wait on the network.
  function preloadEverything() {
    const keys = [...window.QUESTIONS.map((q) => q.id), "finale"];
    let i = 0;
    (function next() {
      if (i >= keys.length) return;
      preloadFolder(keys[i++]);
      setTimeout(next, 1200);
    })();
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch (e) { /* fine — screen may sleep */ }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (wakeLock) requestWakeLock();
      AudioMan.resume(); // heal audio after app switch / screen lock
    }
  });
  // iOS sometimes needs a user gesture to resume after an interruption —
  // the very next tap anywhere heals the audio.
  document.addEventListener("pointerdown", () => AudioMan.resume(), true);

  // ---------- intro ----------
  function initIntro() {
    const wrap = $("#floaters");
    (window.PHOTOS.intro || []).forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "floater f" + (i % 5);
      d.style.backgroundImage = `url(${p.src})`;
      wrap.appendChild(d);
    });
    $("#btn-start").addEventListener("click", onStartTap);
    $("#btn-go").addEventListener("click", startQuiz);
  }

  function onStartTap() {
    AudioMan.unlock();
    AudioMan.intro();
    AudioMan.playFanfare();
    requestWakeLock();
    Confetti.burst(innerWidth / 2, innerHeight * 0.4, 120);
    phase = "ready";
    $("#intro-first").classList.add("hidden");
    $("#intro-ready").classList.remove("hidden");
    preloadEverything();
  }

  function startQuiz() {
    qIndex = 0;
    showQuestion();
  }

  // ---------- question ----------
  function showQuestion() {
    phase = "question";
    const q = window.QUESTIONS[qIndex];
    AudioMan.question();
    $("#progress").textContent = `שאלה ${qIndex + 1} מתוך ${window.QUESTIONS.length}`;
    renderHearts();
    $("#question-text").textContent = q.text;
    const grid = $("#answers");
    grid.innerHTML = "";
    q.answers.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.className = "answer c" + i;
      btn.innerHTML =
        `<span class="shape">${SHAPES[i]}</span>` +
        `<span class="letter">${LETTERS[i]}</span>` +
        `<span class="ans-text">${text}</span>`;
      btn.addEventListener("click", () => onAnswer(i, btn));
      grid.appendChild(btn);
    });
    $("#q-card").classList.remove("revealed");
    answerGuardUntil = performance.now() + 700; // swallow trailing double-taps
    show("#screen-question");
    preloadFolder(q.id);
  }

  function renderHearts() {
    const el = $("#hearts-trail");
    el.innerHTML = "";
    for (let i = 0; i < window.QUESTIONS.length; i++) {
      const s = document.createElement("span");
      s.textContent = "♥";
      s.className = i < qIndex ? "done" : i === qIndex ? "now" : "";
      el.appendChild(s);
    }
  }

  function onAnswer(i, btn) {
    if (phase !== "question" || performance.now() < answerGuardUntil) return;
    phase = "reveal";
    revealGuardUntil = Infinity;
    const q = window.QUESTIONS[qIndex];
    AudioMan.playTap();
    AudioMan.duck(0.1);
    AudioMan.playDrumroll(1.7);
    document.querySelectorAll(".answer").forEach((b) => b.classList.add("locked"));
    btn.classList.add("picked");
    setTimeout(() => doReveal(i, q), 1800);
  }

  function doReveal(picked, q) {
    const buttons = document.querySelectorAll(".answer");
    const correctBtn = buttons[q.correct];
    const right = picked === q.correct;
    buttons.forEach((b, i) => {
      if (i === q.correct) b.classList.add("correct");
      else b.classList.add("dim");
    });
    if (right) {
      AudioMan.playCorrect();
      const r = correctBtn.getBoundingClientRect();
      Confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 110);
    } else {
      buttons[picked].classList.add("wrong");
      AudioMan.playWrong();
      setTimeout(() => AudioMan.playCorrect(), 700);
    }
    const banner = $("#reveal-banner");
    banner.innerHTML =
      `<div class="reveal-verdict">${right ? "נכון!!! 🎉" : "לא נורא! התשובה הנכונה:"}</div>` +
      `<div class="reveal-answer">${q.answers[q.correct]}</div>` +
      `<div class="reveal-line">${q.reveal}</div>`;
    $("#q-card").classList.add("revealed");
    revealGuardUntil = performance.now() + 1600; // then a tap advances early
    revealTimer = setTimeout(startSlideshow, right ? 4200 : 4700);
  }

  // ---------- slideshow ----------
  function startSlideshow() {
    clearTimeout(revealTimer);
    revealTimer = null;
    phase = "slideshow";
    const q = window.QUESTIONS[qIndex];
    const photos = window.PHOTOS[q.id] || [];
    if (!photos.length) return nextQuestion();
    AudioMan.slideshow(qIndex);
    slideIdx = 0;
    currentPhotos = photos;
    slideTapGuardUntil = performance.now() + 900;
    $("#slideshow-title").textContent = q.reveal;
    renderDots(photos.length);
    show("#screen-slideshow");
    runSlide(photos, 0);
    // preload what's next while we watch
    const nextKey = qIndex + 1 < window.QUESTIONS.length ? window.QUESTIONS[qIndex + 1].id : "finale";
    preloadFolder(nextKey);
  }

  function renderDots(n) {
    const el = $("#slide-dots");
    el.innerHTML = "";
    for (let i = 0; i < n; i++) el.appendChild(document.createElement("span"));
  }

  function runSlide(photos, idx) {
    slideIdx = idx;
    const stage = $("#slide-stage");
    if (stage.lastChild) stage.lastChild.classList.add("leaving");
    const p = photos[idx];
    const div = document.createElement("div");
    div.className = "slide kb" + (idx % 2);
    div.style.backgroundImage = `url(${p.src})`;
    div.style.backgroundPosition = p.pos || "50% 45%";
    stage.appendChild(div);
    requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add("visible")));
    // retire old slides
    while (stage.children.length > 2) stage.removeChild(stage.firstChild);
    [...$("#slide-dots").children].forEach((d, i) => d.classList.toggle("on", i <= idx));
    if (idx + 1 < photos.length) {
      slideTimer = setTimeout(() => runSlide(photos, idx + 1), SLIDE_MS);
    } else {
      slideTimer = setTimeout(endSlideshow, SLIDE_MS + 400);
    }
  }

  function endSlideshow() {
    clearTimeout(slideTimer);
    slideTimer = null;
    $("#slide-stage").innerHTML = "";
    nextQuestion();
  }

  function nextQuestion() {
    qIndex++;
    if (qIndex >= window.QUESTIONS.length) return startMontage();
    showQuestion();
  }

  // ---------- finale ----------
  function startMontage() {
    phase = "montage";
    AudioMan.finale();
    const photos = window.PHOTOS.finale || [];
    currentPhotos = photos;
    $("#slideshow-title").textContent = "13 שנים של אהבה ❤️";
    renderDots(photos.length);
    show("#screen-slideshow");
    slideTapGuardUntil = performance.now() + 900;
    montageSlide(photos, 0);
  }

  function montageSlide(photos, idx) {
    slideIdx = idx;
    const stage = $("#slide-stage");
    if (idx >= photos.length) return showEnd();
    if (stage.lastChild) stage.lastChild.classList.add("leaving");
    const p = photos[idx];
    const div = document.createElement("div");
    div.className = "slide kb" + (idx % 2);
    div.style.backgroundImage = `url(${p.src})`;
    div.style.backgroundPosition = p.pos || "50% 45%";
    stage.appendChild(div);
    requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add("visible")));
    while (stage.children.length > 2) stage.removeChild(stage.firstChild);
    [...$("#slide-dots").children].forEach((d, i) => d.classList.toggle("on", i <= idx));
    slideTimer = setTimeout(() => montageSlide(photos, idx + 1), 4600);
  }

  function initEndFloaters() {
    const wrap = $("#floaters-end");
    if (wrap.children.length) return;
    const picks = (window.PHOTOS.finale || []).slice(-5);
    picks.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "floater f" + (i % 5);
      d.style.backgroundImage = `url(${p.src})`;
      wrap.appendChild(d);
    });
  }

  function showEnd() {
    phase = "end";
    clearTimeout(slideTimer);
    endGuardUntil = performance.now() + 900; // don't let a double-tap restart
    $("#slide-stage").innerHTML = "";
    initEndFloaters();
    show("#screen-end");
    Confetti.burst(innerWidth / 2, innerHeight * 0.35, 150);
    const rainLoop = setInterval(() => {
      if (phase !== "end") return clearInterval(rainLoop);
      Confetti.rain(35);
    }, 1800);
    $("#btn-again").onclick = () => {
      if (performance.now() < endGuardUntil) return;
      phase = "ready";
      $("#intro-first").classList.add("hidden");
      $("#intro-ready").classList.remove("hidden");
      show("#screen-intro");
      AudioMan.intro();
    };
  }

  // ---------- global taps ----------
  // During a slideshow/montage a tap advances ONE slide (past the last -> continue).
  // During a reveal (after a short hold) a tap moves on to the slideshow.
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-mute")) return;
    const now = performance.now();
    if (phase === "slideshow" && now > slideTapGuardUntil) {
      clearTimeout(slideTimer);
      slideTapGuardUntil = now + 350;
      if (slideIdx + 1 < currentPhotos.length) runSlide(currentPhotos, slideIdx + 1);
      else endSlideshow();
    } else if (phase === "montage" && now > slideTapGuardUntil) {
      clearTimeout(slideTimer);
      slideTapGuardUntil = now + 350;
      montageSlide(currentPhotos, slideIdx + 1);
    } else if (phase === "reveal" && now > revealGuardUntil) {
      startSlideshow();
    }
  });

  $("#btn-mute").addEventListener("click", (e) => {
    e.stopPropagation();
    const m = !AudioMan.isMuted();
    AudioMan.setMuted(m);
    $("#btn-mute").textContent = m ? "🔇" : "🔊";
  });

  // ---------- boot ----------
  window.addEventListener("DOMContentLoaded", () => {
    Confetti.init();
    initIntro();
    preloadFolder("intro");
    show("#screen-intro");
  });
})();
