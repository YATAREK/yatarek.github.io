// Holographic line portrait on the Home page.
// - Builds a 3D "line sculpture" from a small brightness map (alpha = person mask):
//   each horizontal line gets depth from a rounded volume fitted to the silhouette
//   plus fine relief from brightness.
// - Drag or swipe to rotate it a full 360 degrees (with momentum); idles with a gentle sway.
// - Captions type themselves around the round border while the ring pulses ("talking").
// Works with Material's instant navigation and respects prefers-reduced-motion.
(function () {
  const LINES = [
    "Hi, I'm Yeasin",
    "Materials scientist in Brisbane",
    "I build magnets and superconductors",
    "Machine learning guides my experiments",
    "Drag me to spin me around",
  ];
  const TYPE_MS = 55;
  const HOLD_MS = 2200;
  const ERASE_MS = 22;

  let cleanup = null;

  function init() {
    if (cleanup) { cleanup(); cleanup = null; }
    const holo = document.querySelector(".holo");
    const text = document.getElementById("holo-text");
    const live = document.getElementById("holo-live");
    if (!holo || !text) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [];
    const listeners = [];
    let stopped = false;
    let raf = 0;
    const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); };

    cleanup = () => {
      stopped = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      listeners.forEach(([el, ev, fn, opt]) => el.removeEventListener(ev, fn, opt));
    };

    // ---- Captions around the ring -------------------------------------------
    const STEP_DEG = 5.4;
    function setText(str, fullLen) {
      const len = fullLen || str.length;
      const start = -((len - 1) * STEP_DEG) / 2;
      text.innerHTML = "";
      for (let k = 0; k < str.length; k++) {
        const ch = document.createElement("span");
        ch.textContent = str[k] === " " ? " " : str[k];
        ch.style.transform = "rotate(" + (start + k * STEP_DEG).toFixed(2) + "deg)";
        text.appendChild(ch);
      }
    }
    async function talk() {
      let i = 0;
      while (!stopped) {
        const line = LINES[i % LINES.length];
        if (live) live.textContent = line;
        if (reduced) {
          setText(line);
          await wait(HOLD_MS + 1500);
        } else {
          holo.classList.add("is-talking");
          for (let n = 1; n <= line.length && !stopped; n++) {
            setText(line.slice(0, n), line.length);
            await wait(TYPE_MS);
          }
          holo.classList.remove("is-talking");
          await wait(HOLD_MS);
          for (let n = line.length; n >= 0 && !stopped; n--) {
            setText(line.slice(0, n), line.length);
            await wait(ERASE_MS);
          }
          await wait(250);
        }
        i++;
      }
    }
    talk();

    // ---- 3D line sculpture ---------------------------------------------------
    const canvas = holo.querySelector(".holo__canvas");
    if (!canvas) return;
    const src = new Image();
    src.onload = () => { if (!stopped) build(); };
    src.src = new URL(canvas.dataset.src, document.baseURI).href;

    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth || 216, cssH = canvas.clientHeight || 212;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;

      const off = document.createElement("canvas");
      off.width = src.width; off.height = src.height;
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.drawImage(src, 0, 0);
      const px = octx.getImageData(0, 0, src.width, src.height).data;
      const sw = src.width, sh = src.height;
      const scale = Math.min(W / sw, H / sh);
      const cx = sw / 2;

      // 3D polylines: x, y centred on the image; z = rounded volume + brightness relief.
      const ROW = 3, STEP = 2, RELIEF = 6;
      const rows = [];
      for (let y = 1; y < sh; y += ROW) {
        let x0 = -1, x1 = -1;
        for (let x = 0; x < sw; x++) {
          if (px[(y * sw + x) * 4 + 3] >= 128) { if (x0 < 0) x0 = x; x1 = x; }
        }
        const segs = [];
        if (x0 >= 0) {
          const mid = (x0 + x1) / 2, half = Math.max(4, (x1 - x0) / 2);
          const depth = half * 0.75;
          let seg = [];
          for (let x = x0; x <= x1; x += STEP) {
            const i = (y * sw + x) * 4;
            if (px[i + 3] < 128) { if (seg.length > 1) segs.push(seg); seg = []; continue; }
            const l = px[i] / 255;
            const u = Math.min(1, Math.abs(x - mid) / half);
            const z = depth * Math.sqrt(1 - u * u) + RELIEF * l;
            seg.push({ x: x - cx, y: y - sh / 2, z, l });
          }
          if (seg.length > 1) segs.push(seg);
          // back shell: closes the volume so the figure reads as 3D from every side
          const backSeg = [];
          for (let x = x0; x <= x1; x += STEP * 2) {
            const i = (y * sw + x) * 4;
            if (px[i + 3] < 128) continue;
            const u = Math.min(1, Math.abs(x - mid) / half);
            backSeg.push({ x: x - cx, y: y - sh / 2, z: -depth * 0.9 * Math.sqrt(1 - u * u), l: 0.22 });
          }
          if (backSeg.length > 1) segs.push(backSeg);
        }
        rows.push(segs);
      }

      const colour = getComputedStyle(holo).getPropertyValue("--holo").trim() || "#6fd3ff";
      const BINS = 6; // batch segments by brightness: only a few strokes per frame

      let angle = 0, vel = 0, dragging = false, lastX = 0, lastT = 0;
      let idleSince = performance.now();

      function draw(revealRows, revealFrac, scanY) {
        ctx.clearRect(0, 0, W, H);
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const camera = 520;
        const front = Array.from({ length: BINS }, () => new Path2D());
        const back = Array.from({ length: BINS }, () => new Path2D());
        const nRows = Math.min(rows.length, revealRows + 1);
        for (let r = 0; r < nRows; r++) {
          for (const seg of rows[r]) {
            const limit = r === revealRows ? Math.floor(seg.length * revealFrac) : seg.length;
            for (let k = 1; k < limit; k++) {
              const a = seg[k - 1], b = seg[k];
              const ax = a.x * ca + a.z * sa, az = -a.x * sa + a.z * ca;
              const bx = b.x * ca + b.z * sa, bz = -b.x * sa + b.z * ca;
              const pa = camera / (camera - az), pb = camera / (camera - bz);
              let bin = Math.min(BINS - 1, Math.floor(((a.l + b.l) / 2) * BINS));
              if (scanY !== null && Math.abs(a.y - scanY) < 8) bin = BINS - 1;
              const path = (az + bz) / 2 < 0 ? back[bin] : front[bin];
              path.moveTo(W / 2 + ax * pa * scale, H / 2 + a.y * pa * scale);
              path.lineTo(W / 2 + bx * pb * scale, H / 2 + b.y * pb * scale);
            }
          }
        }
        ctx.strokeStyle = colour;
        ctx.lineCap = "round";
        for (let b = 0; b < BINS; b++) {
          const l = (b + 0.5) / BINS;
          ctx.lineWidth = (0.35 + 1.5 * Math.pow(l, 1.4)) * dpr;
          ctx.globalAlpha = (0.18 + 0.82 * l) * 0.35; // far side is dimmer
          ctx.stroke(back[b]);
          ctx.globalAlpha = 0.18 + 0.82 * l;
          ctx.stroke(front[b]);
        }
        ctx.globalAlpha = 1;
      }

      if (reduced) { draw(rows.length, 1, null); return; }

      // Drag or swipe horizontally to rotate; vertical swipes still scroll the page.
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      on(canvas, "pointerdown", (e) => {
        dragging = true; lastX = e.clientX; lastT = performance.now(); vel = 0;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      });
      on(canvas, "pointermove", (e) => {
        if (!dragging) return;
        const t = performance.now(), dx = e.clientX - lastX;
        angle += dx * 0.012;
        vel = ((dx * 0.012) / Math.max(1, t - lastT)) * 16;
        lastX = e.clientX; lastT = t;
      });
      const release = () => { dragging = false; idleSince = performance.now(); canvas.style.cursor = "grab"; };
      on(canvas, "pointerup", release);
      on(canvas, "pointercancel", release);

      const BUILD_MS = 2600;
      const TWO_PI = Math.PI * 2;
      let t0 = performance.now();
      function frame(now) {
        if (stopped) return;
        if (!dragging) {
          if (Math.abs(vel) > 0.0005) { angle += vel; vel *= 0.95; idleSince = now; }
          else if (now - idleSince > 2500) {
            // ease back the shortest way into a gentle sway
            const target = Math.sin(now / 2600) * 0.35;
            const d = (((target - angle) % TWO_PI) + TWO_PI * 1.5) % TWO_PI - Math.PI;
            angle += d * 0.03;
          }
        }
        const p = Math.min(1, (now - t0) / BUILD_MS);
        const reveal = p * rows.length;
        const scanY = p < 1 ? null : (((now / 3200) % 1.4) - 0.2) * sh - sh / 2;
        draw(Math.floor(reveal), reveal - Math.floor(reveal), scanY);
        if (p >= 1 && now - t0 > BUILD_MS + 18000 && !dragging) t0 = now; // rebuild now and then
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
