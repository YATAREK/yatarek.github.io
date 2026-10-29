// Home page background: a swirling radial field of short rounded dashes.
// Dashes point away from a centre that glides after the pointer, are densest in a
// ring around it and fade to tiny specks further out. Colour shifts around the
// circle from blue through purple to red. The field slowly swirls and breathes.
// Home only; pauses when hidden; static when prefers-reduced-motion is set.
// Works with Material's instant navigation.
(function () {
  const BLUE = [59, 110, 230], PURPLE = [124, 77, 196], RED = [230, 70, 70];
  let cleanup = null;

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // colour by angle: red on one side, purple in between, blue elsewhere
  function colourFor(theta) {
    const c = (Math.cos(theta) + 1) / 2;          // 1 on the right, 0 on the left
    const t = Math.max(0, (c - 0.55) / 0.45);       // only the right part warms up
    return t < 0.5 ? mix(BLUE, PURPLE, t * 2) : mix(PURPLE, RED, (t - 0.5) * 2);
  }

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
        };
      });
      if (!target.x) { target.x = centre.x = W / 2; target.y = centre.y = H * 0.42; }
    }

    function draw(now) {
      const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
      ctx.clearRect(0, 0, W, H);
      // centre glides toward the pointer
      centre.x += (target.x - centre.x) * 0.06;
      centre.y += (target.y - centre.y) * 0.06;
      const ring = Math.min(W, H) * 0.42;
      const breathe = reduced ? 1 : 1 + 0.035 * Math.sin(now * 0.0011);
      ctx.lineCap = "round";
      for (const p of parts) {
        // swirl: inner dashes turn a little faster than outer ones
        if (!reduced) p.theta += (0.00022 * ring) / (p.r + 60);
        const r = p.r * breathe * (1 + 0.02 * Math.sin(now * 0.002 + p.phase));
        const ct = Math.cos(p.theta), st = Math.sin(p.theta);
        const x = centre.x + ct * r, y = centre.y + st * r;
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;

        // strongest near the ring, fading inside and far outside
        const d = Math.abs(r - ring) / ring;
        const k = Math.max(0, 1 - d * 1.2);
        const len = (0.6 + 2.6 * k) * p.w;          // short capsule half-length
        const thick = (1.0 + 2.4 * k) * p.w;
        const [cr, cg, cb] = colourFor(p.theta);
        ctx.globalAlpha = (dark ? 0.25 : 0.2) + (dark ? 0.7 : 0.65) * k;
        ctx.strokeStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
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
