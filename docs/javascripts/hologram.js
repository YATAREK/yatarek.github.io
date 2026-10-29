// Holographic talking portrait on the Home page.
// Types short captions along the round border (the "voice"), pulses the ring while
// talking, and tilts the hologram toward the pointer. Works with Material's
// instant navigation and respects prefers-reduced-motion.
(function () {
  const LINES = [
    "Hi, I'm Yeasin",
    "Materials scientist in Brisbane",
    "I build magnets and superconductors",
    "Machine learning guides my experiments",
    "Scroll down to see my work",
  ];
  const TYPE_MS = 55;     // per character
  const HOLD_MS = 2200;   // pause on a finished line
  const ERASE_MS = 22;    // per character when clearing

  let cleanup = null;

  function init() {
    if (cleanup) { cleanup(); cleanup = null; }
    const holo = document.querySelector(".holo");
    const text = document.getElementById("holo-text");
    const live = document.getElementById("holo-live");
    if (!holo || !text) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [];
    let stopped = false;
    const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));

    // Place each character around the circle, centred at the top.
    const STEP_DEG = 5.4; // angular spacing per character
    function setText(str, fullLen) {
      const len = fullLen || str.length;
      const start = -((len - 1) * STEP_DEG) / 2;
      text.innerHTML = "";
      for (let k = 0; k < str.length; k++) {
        const ch = document.createElement("span");
        ch.textContent = str[k] === " " ? "\u00a0" : str[k];
        ch.style.transform = "rotate(" + (start + k * STEP_DEG).toFixed(2) + "deg)";
        text.appendChild(ch);
      }
    }

    // Captions: type, hold, erase, next line.
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

    // ---- Line-drawn portrait ------------------------------------------------
    // A small brightness map (alpha = person mask) becomes glowing horizontal
    // lines: brighter, thicker and slightly raised where the photo is lighter.
    const canvas = holo.querySelector(".holo__canvas");
    let raf = 0;
    if (canvas) {
      const src = new Image();
      src.onload = () => {
        if (stopped) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || 216, cssH = canvas.clientHeight || 212;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext("2d");
        const W = canvas.width, H = canvas.height;

        // read the brightness map
        const off = document.createElement("canvas");
        off.width = src.width; off.height = src.height;
        const octx = off.getContext("2d", { willReadFrequently: true });
        octx.drawImage(src, 0, 0);
        const px = octx.getImageData(0, 0, src.width, src.height).data;
        const sx = W / src.width, sy = H / src.height;

        // pre-render the finished portrait once
        const art = document.createElement("canvas");
        art.width = W; art.height = H;
        const actx = art.getContext("2d");
        const colour = getComputedStyle(holo).getPropertyValue("--holo").trim() || "#6fd3ff";
        actx.strokeStyle = colour;
        actx.lineCap = "round";
        const ROW = 3;      // source rows between lines
        const RISE = 2.2;   // relief in source pixels
        const rows = [];
        for (let y = 1; y < src.height; y += ROW) {
          rows.push(y * sy);
          for (let x = 1; x < src.width; x += 2) {
            const i0 = (y * src.width + x - 1) * 4, i1 = (y * src.width + x + 1) * 4;
            const a0 = px[i0 + 3], a1 = px[i1 + 3];
            if (a0 < 128 || a1 < 128) continue;
            const l0 = px[i0] / 255, l1 = px[i1] / 255, l = (l0 + l1) / 2;
            actx.globalAlpha = 0.18 + 0.82 * l;
            actx.lineWidth = (0.35 + 1.5 * Math.pow(l, 1.4)) * dpr;
            actx.beginPath();
            actx.moveTo((x - 1) * sx, (y - RISE * l0) * sy);
            actx.lineTo((x + 1) * sx, (y - RISE * l1) * sy);
            actx.stroke();
          }
        }
        const band = ROW * sy; // height of one line band in canvas pixels

        if (reduced) { ctx.drawImage(art, 0, 0); return; }

        // construct row by row, then idle with a scan band and rare glitches
        const BUILD_MS = 2600;
        let t0 = performance.now();
        let nextRebuild = t0 + 16000;
        function frame(now) {
          if (stopped) return;
          ctx.clearRect(0, 0, W, H);
          const p = Math.min(1, (now - t0) / BUILD_MS);
          if (p < 1) {
            const done = p * rows.length;
            const full = Math.floor(done);
            if (full > 0) {
              const hFull = Math.min(H, full * band + band * 0.6);
              ctx.drawImage(art, 0, 0, W, hFull, 0, 0, W, hFull);
            }
            const yCur = full * band + band * 0.6;
            const wCur = (done - full) * W;
            if (wCur > 0 && yCur < H) {
              ctx.drawImage(art, 0, yCur, wCur, band, 0, yCur, wCur, band);
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = colour;
              ctx.fillRect(wCur - 2 * dpr, yCur, 3 * dpr, band); // drawing head
              ctx.globalAlpha = 1;
            }
          } else {
            const talking = holo.classList.contains("is-talking");
            ctx.globalAlpha = talking ? 0.92 + 0.08 * Math.sin(now / 70) : 0.95;
            // rare horizontal glitch on a few rows
            const glitch = Math.random() < 0.012;
            if (glitch) {
              const gy = Math.random() * H, gh = band * (2 + Math.random() * 4);
              ctx.drawImage(art, 0, 0, W, gy, 0, 0, W, gy);
              ctx.drawImage(art, 0, gy, W, gh, (Math.random() - 0.5) * 8 * dpr, gy, W, gh);
              ctx.drawImage(art, 0, gy + gh, W, H - gy - gh, 0, gy + gh, W, H - gy - gh);
            } else {
              ctx.drawImage(art, 0, 0);
            }
            // scan band sweeping down
            const sy2 = ((now / 3200) % 1.4 - 0.2) * H;
            ctx.globalCompositeOperation = "source-atop";
            const grad = ctx.createLinearGradient(0, sy2 - 24 * dpr, 0, sy2 + 24 * dpr);
            grad.addColorStop(0, "rgba(255,255,255,0)");
            grad.addColorStop(0.5, "rgba(255,255,255,0.55)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = grad;
            ctx.globalAlpha = 1;
            ctx.fillRect(0, sy2 - 24 * dpr, W, 48 * dpr);
            ctx.globalCompositeOperation = "source-over";
            if (now > nextRebuild) { t0 = now; nextRebuild = now + BUILD_MS + 16000; }
          }
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
      };
      src.src = canvas.dataset.src.startsWith("/") ? canvas.dataset.src : new URL(canvas.dataset.src, document.baseURI).href;
    }

    // Pointer tilt (desktop only).
    const stage = holo.querySelector(".holo__stage");
    function onMove(e) {
      const r = holo.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      stage.style.setProperty("--ry", (dx * 30).toFixed(2) + "deg");
      stage.style.setProperty("--rx", (-dy * 24).toFixed(2) + "deg");
    }
    if (!reduced && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    cleanup = () => {
      stopped = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
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
