// Home page background: a sparse field of tiny drifting dashes, and a water-drop
// ripple wherever you click or tap. The ripple draws fading rings and pushes nearby
// dashes outward as the wave passes, after which they settle back into their drift.
// Home only; pauses when hidden; still image for prefers-reduced-motion.
// Works with Material's instant navigation.
(function () {
  // mostly soft neutrals with a few colour accents
  const COLOURS = ["#8a8f98", "#8a8f98", "#9aa3b2", "#5b8fb9", "#7b6fd0", "#d97757", "#c9a227", "#8fae7e"];
  const RIPPLE_SPEED = 0.42;   // px per ms
  const RIPPLE_LIFE = 1600;    // ms
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

    let W = 0, H = 0, dots = [], ripples = [], raf = 0, stopped = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((W * H) / 6500);
      while (dots.length < target) dots.push(spawn());
      dots.length = target;
    }

    function spawn() {
      return {
        x: Math.random() * W, y: Math.random() * H,
        ox: 0, oy: 0, vx: 0, vy: 0,          // ripple offset and its velocity
        len: Math.random() < 0.2 ? 0 : 1 + Math.random() * 2.2,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.0006,
        size: 0.7 + Math.random() * 0.7,
        colour: COLOURS[(Math.random() * COLOURS.length) | 0],
        alpha: 0.35 + Math.random() * 0.5,
        drift: 0.004 + Math.random() * 0.01,
        phase: Math.random() * Math.PI * 2,
      };
    }

    let last = performance.now();
    function frame(now) {
      if (stopped) return;
      const dt = Math.min(48, now - last); last = now;
      const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
      ctx.clearRect(0, 0, W, H);

      // ripples: expanding rings
      ripples = ripples.filter((r) => now - r.t0 < RIPPLE_LIFE);
      for (const r of ripples) {
        const age = now - r.t0, rad = age * RIPPLE_SPEED;
        const fade = 1 - age / RIPPLE_LIFE;
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const rr = rad - k * 22;
          if (rr <= 0) continue;
          ctx.globalAlpha = 0.28 * fade * (1 - k * 0.3);
          ctx.strokeStyle = dark ? "#9ecbf0" : "#5b8fb9";
          ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }

      for (const d of dots) {
        if (!reduced) {
          // slow upward drift and gentle rotation (the "antigravity" float)
          d.y -= d.drift * dt;
          d.x += Math.sin(now * 0.0004 + d.phase) * 0.004 * dt;
          d.angle += d.spin * dt;
          if (d.y < -6) { d.y = H + 6; d.x = Math.random() * W; }

          // ripple push: dashes near the wavefront get kicked outward
          for (const r of ripples) {
            const age = now - r.t0, rad = age * RIPPLE_SPEED;
            const dx = d.x + d.ox - r.x, dy = d.y + d.oy - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const band = Math.abs(dist - rad);
            if (band < 26) {
              const f = (1 - band / 26) * (1 - age / RIPPLE_LIFE) * 0.9;
              d.vx += (dx / dist) * f; d.vy += (dy / dist) * f;
            }
          }
          // spring back to rest
          d.vx += -d.ox * 0.02; d.vy += -d.oy * 0.02;
          d.vx *= 0.88; d.vy *= 0.88;
          d.ox += d.vx; d.oy += d.vy;
        }

        const x = d.x + d.ox, y = d.y + d.oy;
        const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(now * 0.0015 + d.phase);
        ctx.globalAlpha = d.alpha * tw * (dark ? 0.9 : 0.75);
        ctx.strokeStyle = ctx.fillStyle = d.colour;
        if (d.len === 0) {
          ctx.beginPath(); ctx.arc(x, y, d.size * 0.55, 0, Math.PI * 2); ctx.fill();
        } else {
          const cx = Math.cos(d.angle) * d.len, cy = Math.sin(d.angle) * d.len;
          ctx.lineWidth = d.size; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x - cx, y - cy); ctx.lineTo(x + cx, y + cy); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    // a click or tap anywhere (except on links, buttons and inputs) drops a ripple
    const onDown = (e) => {
      if (reduced) return;
      if (e.target.closest("a, button, input, textarea, select, label, dialog, .md-sidebar, .md-header")) return;
      ripples.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
      if (ripples.length > 6) ripples.shift();
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
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
