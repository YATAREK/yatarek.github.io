// Home page background: a real-time water surface with floating colour dots.
// - A 2D wave equation runs on a coarse grid; moving the pointer leaves a wake,
//   a click or tap drops a bigger "stone". Waves spread, interfere and decay.
// - The surface is lit by its slope, giving soft moving highlights.
// - Sparse, larger dots float on the water: they shift with the waves and slowly
//   cycle through colours.
// Home only; pauses when hidden; static when prefers-reduced-motion is set.
// Works with Material's instant navigation.
(function () {
  const CELL = 7;          // simulation cell size in CSS px
  const DAMPING = 0.986;   // energy kept per step (closer to 1 = longer-lived waves)
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

    // low-resolution canvas for the water shading, scaled up smoothly
    const water = document.createElement("canvas");
    const wctx = water.getContext("2d");

    let W = 0, H = 0, GW = 0, GH = 0, cur, prev, img, dots = [], raf = 0, stopped = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      GW = Math.ceil(W / CELL) + 2; GH = Math.ceil(H / CELL) + 2;
      cur = new Float32Array(GW * GH); prev = new Float32Array(GW * GH);
      water.width = GW; water.height = GH;
      img = wctx.createImageData(GW, GH);
      const target = Math.max(18, Math.round((W * H) / 16000)); // sparse
      dots = Array.from({ length: target }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: 2 + Math.random() * 2.6,
        hue: Math.random() * 360,
        hueSpeed: 0.02 + Math.random() * 0.03,
        drift: (Math.random() - 0.5) * 0.12,
        rise: 0.04 + Math.random() * 0.08,
      }));
    }

    // add a smooth bump of energy at (x, y)
    function disturb(x, y, radius, strength) {
      const gx = Math.round(x / CELL) + 1, gy = Math.round(y / CELL) + 1;
      const rc = Math.max(1, Math.round(radius / CELL));
      for (let j = -rc; j <= rc; j++) {
        for (let i = -rc; i <= rc; i++) {
          const xx = gx + i, yy = gy + j;
          if (xx < 1 || yy < 1 || xx >= GW - 1 || yy >= GH - 1) continue;
          const d = Math.sqrt(i * i + j * j) / rc;
          if (d > 1) continue;
          cur[yy * GW + xx] += strength * (0.5 + 0.5 * Math.cos(Math.PI * d));
        }
      }
    }

    function stepWater() {
      // classic two-buffer wave propagation
      for (let y = 1; y < GH - 1; y++) {
        for (let x = 1; x < GW - 1; x++) {
          const i = y * GW + x;
          const v = (cur[i - 1] + cur[i + 1] + cur[i - GW] + cur[i + GW]) * 0.5 - prev[i];
          prev[i] = v * DAMPING;
        }
      }
      const t = prev; prev = cur; cur = t;
    }

    function heightAt(x, y) {
      const gx = Math.min(GW - 2, Math.max(1, Math.round(x / CELL) + 1));
      const gy = Math.min(GH - 2, Math.max(1, Math.round(y / CELL) + 1));
      const i = gy * GW + gx;
      return { h: cur[i], sx: cur[i + 1] - cur[i - 1], sy: cur[i + GW] - cur[i - GW] };
    }

    function render(now) {
      const dark = document.body.getAttribute("data-md-color-scheme") === "slate";
      ctx.clearRect(0, 0, W, H);

      // water shading from the surface slope (light from the top-left)
      const data = img.data;
      const tint = dark ? [158, 203, 240] : [70, 120, 170];
      for (let y = 1; y < GH - 1; y++) {
        for (let x = 1; x < GW - 1; x++) {
          const i = y * GW + x;
          const s = (cur[i - 1] - cur[i + 1]) + (cur[i - GW] - cur[i + GW]);
          const a = Math.min(1, Math.abs(s) * 0.06);
          const p = i * 4;
          data[p] = tint[0]; data[p + 1] = tint[1]; data[p + 2] = tint[2];
          data[p + 3] = s > 0 ? a * (dark ? 150 : 110) : a * (dark ? 60 : 45);
        }
      }
      wctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(water, -CELL, -CELL, GW * CELL, GH * CELL);

      // floating colour dots, displaced by the waves
      for (const d of dots) {
        if (!reduced) {
          d.x += d.drift; d.y -= d.rise;
          if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
          if (d.x < -10) d.x = W + 10; else if (d.x > W + 10) d.x = -10;
          d.hue = (d.hue + d.hueSpeed * 16) % 360;
        }
        const w = heightAt(d.x, d.y);
        const x = d.x + w.sx * 0.9, y = d.y + w.sy * 0.9;
        const r = Math.max(0.8, d.r * (1 + w.h * 0.02));
        ctx.globalAlpha = dark ? 0.8 : 0.7;
        ctx.fillStyle = `hsl(${d.hue.toFixed(0)}, 70%, ${dark ? 66 : 52}%)`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    let last = 0;
    function frame(now) {
      if (stopped) return;
      // run the simulation at a steady ~60 steps per second
      if (now - last > 14) { stepWater(); last = now; }
      render(now);
      raf = requestAnimationFrame(frame);
    }

    // moving the pointer leaves a wake; faster movement makes bigger waves
    let px = null, py = null;
    const onMove = (e) => {
      if (reduced) return;
      const x = e.clientX, y = e.clientY;
      if (px !== null) {
        const dx = x - px, dy = y - py, dist = Math.hypot(dx, dy);
        const steps = Math.min(8, Math.ceil(dist / CELL));
        const strength = Math.min(14, 2 + dist * 0.35);
        for (let s = 1; s <= steps; s++) disturb(px + (dx * s) / steps, py + (dy * s) / steps, 14, strength / steps);
      }
      px = x; py = y;
    };
    const onLeave = () => { px = py = null; };
    const onDown = (e) => {
      if (reduced) return;
      if (e.target.closest("a, button, input, textarea, select, label, dialog, .md-sidebar, .md-header")) return;
      disturb(e.clientX, e.clientY, 26, 70);
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    if (reduced) render(0); else raf = requestAnimationFrame(frame);

    cleanup = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
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
