// Drifting dot field behind the Home page.
// Tiny dots and short streaks in the site palette float along a slow flow field,
// twinkle, and ease away from the pointer. Home page only; pauses when hidden;
// static when the visitor prefers reduced motion. Works with instant navigation.
(function () {
  const COLOURS = ["#d97757", "#5b8fb9", "#8fae7e", "#c9a227", "#9ecbf0", "#e8956f"];
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

    let W = 0, H = 0, dpr = 1, dots = [], raf = 0, stopped = false;
    const pointer = { x: -9999, y: -9999 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((W * H) / 5200); // density
      while (dots.length < target) dots.push(spawn(true));
      dots.length = target;
    }

    function spawn(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -4,
        len: Math.random() < 0.55 ? 0 : 1.5 + Math.random() * 3.5, // dot or short streak
        size: 0.6 + Math.random() * 1.1,
        colour: COLOURS[(Math.random() * COLOURS.length) | 0],
        alpha: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.08 + Math.random() * 0.22,
        vx: 0, vy: 0,
      };
    }

    // smooth pseudo-flow: angle varies slowly with position and time
    function flow(x, y, t) {
      return Math.sin(x * 0.0021 + t * 0.00011) * 1.4 + Math.cos(y * 0.0027 - t * 0.00009) * 1.1;
    }

    function step(now) {
      if (stopped) return;
      const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const a = flow(d.x, d.y, now);
        if (!reduced) {
          // gentle drift along the flow, plus pointer repulsion
          let ax = Math.cos(a) * d.speed, ay = Math.sin(a) * d.speed * 0.6 - 0.03;
          const dx = d.x - pointer.x, dy = d.y - pointer.y, r2 = dx * dx + dy * dy;
          if (r2 < 140 * 140) {
            const f = (1 - Math.sqrt(r2) / 140) * 1.6;
            const r = Math.sqrt(r2) || 1;
            ax += (dx / r) * f; ay += (dy / r) * f;
          }
          d.vx = d.vx * 0.9 + ax * 0.1;
          d.vy = d.vy * 0.9 + ay * 0.1;
          d.x += d.vx; d.y += d.vy;
          if (d.x < -10) d.x = W + 10; else if (d.x > W + 10) d.x = -10;
          if (d.y < -10) d.y = H + 10; else if (d.y > H + 10) d.y = -10;
        }
        const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(now * 0.0012 + d.phase);
        ctx.globalAlpha = d.alpha * tw * (dark ? 1 : 0.85);
        ctx.strokeStyle = ctx.fillStyle = d.colour;
        if (d.len === 0) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.lineWidth = d.size * 0.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(d.x - Math.cos(a) * d.len, d.y - Math.sin(a) * d.len);
          ctx.lineTo(d.x + Math.cos(a) * d.len, d.y + Math.sin(a) * d.len);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(step);
    }

    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; };
    const onLeave = () => { pointer.x = pointer.y = -9999; };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(step);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(step);

    cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
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
