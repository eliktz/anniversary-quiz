// Lightweight canvas confetti: floating hearts + gold sparks. No dependencies.
window.Confetti = (function () {
  let canvas, ctx, parts = [], rafId = null, dpr = 1;

  function init() {
    canvas = document.getElementById("confetti-canvas");
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }

  function heart(x, y, s, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-5, -2, -2.5, -6, 0, -3);
    ctx.bezierCurveTo(2.5, -6, 5, -2, 0, 3);
    ctx.fill();
    ctx.restore();
  }

  const COLORS = ["#ff6b8a", "#ffd166", "#f4a4b8", "#e8c547", "#ff8fa3", "#ffe3a3"];

  function burst(cx, cy, count) {
    const x = (cx != null ? cx : innerWidth / 2) * dpr;
    const y = (cy != null ? cy : innerHeight / 2) * dpr;
    for (let i = 0; i < (count || 90); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (3 + Math.random() * 9) * dpr;
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 4 * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        s: (0.9 + Math.random() * 2.1) * dpr,
        life: 1,
        decay: 0.006 + Math.random() * 0.008,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        spark: Math.random() < 0.35,
      });
    }
    if (!rafId) loop();
  }

  function rain(count) {
    for (let i = 0; i < (count || 60); i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -20 * dpr - Math.random() * canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 1.5 * dpr,
        vy: (1 + Math.random() * 2.2) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        s: (1 + Math.random() * 2.4) * dpr,
        life: 1,
        decay: 0.0022,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        spark: Math.random() < 0.25,
        sway: Math.random() * Math.PI * 2,
      });
    }
    if (!rafId) loop();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter((p) => p.life > 0 && p.y < canvas.height + 40 * dpr);
    if (!parts.length) {
      cancelAnimationFrame(rafId);
      rafId = null;
      return;
    }
    for (const p of parts) {
      p.vy += 0.12 * dpr;      // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      if (p.sway != null) { p.sway += 0.02; p.x += Math.sin(p.sway) * 0.6 * dpr; }
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.spark) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.s * 1.5, -p.s * 0.5, p.s * 3, p.s);
        ctx.restore();
      } else {
        heart(p.x, p.y, p.s * 0.55, p.rot, p.color, Math.max(0, p.life));
      }
    }
  }

  return { init, burst, rain };
})();
