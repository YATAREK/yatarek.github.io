// Home page background: a swirling radial field of short rounded dashes.
// Each dash slowly travels, at its own pace, toward a slot in a ring around the
// pointer, points away from it, and continuously cycles through colours.
// The ring slowly swirls and breathes.
// Home only; pauses when hidden; static when prefers-reduced-motion is set.
// Works with Material's instant navigation.
(function () {
  let cleanup = null;


  function init() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (!document.querySelector(".term")) return; // Home only

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    canvas.className = "dot-field";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");

    let W = 0, H = 0, parts = [], raf = 0, stopped = false;
    const centre = { x: 0, y: 0 }, target = { x: 0, y: 0 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ring = Math.min(W, H) * 0.42;            // radius of the dense ring
      const count = Math.round((W * H) / 1700);
      parts = Array.from({ length: count }, () => {
        // most dashes cluster around the ring, a few scatter far out
        const far = Math.random() < 0.3;
        const r = far
          ? ring * (1.3 + Math.random() * 1.6)
          : ring * (0.35 + Math.pow(Math.random(), 0.8) * 1.1);
        return {
          r, theta: Math.random() * Math.PI * 2,
          w: 0.6 + Math.random() * 0.8,              // size factor
          phase: Math.random() * Math.PI * 2,
          x: Math.random() * W, y: Math.random() * H, // current position on screen
          ease: 0.004 + Math.random() * 0.018,        // own travel speed (slow, staggered)
          hue: Math.random() * 360,                   // own colour, cycles continuously
          hueSpeed: 0.015 + Math.random() * 0.03,
        };
      });
      if (!target.x) { target.x = centre.x = W / 2; target.y = centre.y = H * 0.42; }
    }

    function draw(now) {
      const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
      ctx.clearRect(0, 0, W, H);
      // the pointer sets where the ring should form; each dash travels there on its own
      centre.x = target.x;
      centre.y = target.y;
      const ring = Math.min(W, H) * 0.42;
      const breathe = reduced ? 1 : 1 + 0.035 * Math.sin(now * 0.0011);
      ctx.lineCap = "round";
      for (const p of parts) {
        // swirl: inner dashes turn a little faster than outer ones
        if (!reduced) p.theta += (0.00022 * ring) / (p.r + 60);
        const r = p.r * breathe * (1 + 0.02 * Math.sin(now * 0.002 + p.phase));
        const sx = centre.x + Math.cos(p.theta) * r, sy = centre.y + Math.sin(p.theta) * r;
        if (reduced) { p.x = sx; p.y = sy; }
        else { p.x += (sx - p.x) * p.ease; p.y += (sy - p.y) * p.ease; }
        const x = p.x, y = p.y;
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        // orient each dash away from the pointer, wherever the dash currently is
        const ang = Math.atan2(y - centre.y, x - centre.x);
        const ct = Math.cos(ang), st = Math.sin(ang);
        const dist = Math.hypot(x - centre.x, y - centre.y);

        // strongest near the ring, fading inside and far outside
        const d = Math.abs(dist - ring) / ring;
        const k = Math.max(0, 1 - d * 1.2);
        const len = (0.6 + 2.6 * k) * p.w;          // short capsule half-length
        const thick = (1.0 + 2.4 * k) * p.w;
        if (!reduced) p.hue = (p.hue + p.hueSpeed * 16) % 360;   // continuous colour change
        ctx.globalAlpha = (dark ? 0.3 : 0.25) + (dark ? 0.65 : 0.6) * k;
        ctx.strokeStyle = `hsl(${p.hue.toFixed(0)}, 75%, ${dark ? 62 : 50}%)`;
        ctx.lineWidth = thick;
        ctx.beginPath();
        ctx.moveTo(x - ct * len, y - st * len);     // oriented radially
        ctx.lineTo(x + ct * len, y + st * len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (stopped) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    const onMove = (e) => { target.x = e.clientX; target.y = e.clientY; };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    if (reduced) draw(0); else raf = requestAnimationFrame(frame);

    cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      canvas.remove();
    };
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
