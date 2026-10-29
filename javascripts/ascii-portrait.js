// Colour ASCII portrait for the Home terminal card.
// Each character takes the colour of the photo under it, and its density follows
// brightness, so the face stays recognisable while the whole image is made of text.
// Prints in row by row, then a few characters flicker like a live terminal.
// Works with Material's instant navigation and respects prefers-reduced-motion.
(function () {
  const RAMP = "xxoaeO08#%&@";      // all fairly full glyphs: colour carries the image
  const COLS = 116;                   // characters across the circle
  const CHAR_ASPECT = 1.75;           // cell height / cell width

  let cleanup = null;

  function init() {
    if (cleanup) { cleanup(); cleanup = null; }
    const canvas = document.querySelector(".term__canvas");
    if (!canvas) return;

    let stopped = false, raf = 0, timer = 0;
    cleanup = () => { stopped = true; cancelAnimationFrame(raf); clearInterval(timer); };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const img = new Image();
    img.onload = () => { if (!stopped) start(); };
    img.src = new URL(canvas.dataset.src, document.baseURI).href;

    function start() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth || 400;
      canvas.width = canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext("2d");
      const W = canvas.width;

      // read the source pixels
      const off = document.createElement("canvas");
      off.width = img.width; off.height = img.height;
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.drawImage(img, 0, 0);
      const px = octx.getImageData(0, 0, img.width, img.height).data;

      const cw = W / COLS, ch = cw * CHAR_ASPECT;
      const ROWS = Math.floor(W / ch);
      const r0 = (W - ROWS * ch) / 2;
      const R = W / 2 - cw;

      // build the cell list once
      const cells = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = (c + 0.5) * cw, y = r0 + (r + 0.5) * ch;
          if ((x - W / 2) ** 2 + (y - W / 2) ** 2 > R * R) continue;
          const sx = Math.min(img.width - 1, Math.floor((x / W) * img.width));
          const sy = Math.min(img.height - 1, Math.floor((y / W) * img.height));
          const i = (sy * img.width + sx) * 4;
          if (px[i + 3] < 128) {
            cells.push({ r, x, y, bg: true });
            continue;
          }
          // lift dark tones so hair and shadows stay visible on the dark card
          const lift = (v) => Math.round(255 * Math.pow(0.16 + 0.84 * (v / 255), 0.8));
          const red = lift(px[i]), gr = lift(px[i + 1]), bl = lift(px[i + 2]);
          const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
          const k = Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length));
          cells.push({ r, x, y, k, col: `rgb(${red},${gr},${bl})` });
        }
      }

      ctx.font = `700 ${(ch * 1.0).toFixed(2)}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      function paint(maxRow, jitter) {
        ctx.clearRect(0, 0, W, W);
        const light = document.body.getAttribute("data-md-color-scheme") !== "slate";
        if (light) {
          // dark backdrop only behind the person, so the photo area reads as a screen
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#141312";
          for (const cell of cells) {
            if (cell.bg || cell.r > maxRow) continue;
            ctx.fillRect(cell.x - cw / 2 - 0.5, cell.y - ch / 2 - 0.5, cw + 1, ch + 1);
          }
        }
        for (const cell of cells) {
          if (cell.r > maxRow) continue;
          if (cell.bg) {
            ctx.globalAlpha = light ? 0.18 : 0.10;
            ctx.fillStyle = light ? "#5b8fb9" : "#9ecbf0";
            ctx.fillText(".", cell.x, cell.y);
            continue;
          }
          let k = cell.k;
          if (jitter && Math.random() < 0.012) k = Math.max(0, Math.min(RAMP.length - 1, k + (Math.random() < 0.5 ? -1 : 1)));
          ctx.globalAlpha = 1;
          ctx.fillStyle = cell.col;
          ctx.fillText(RAMP[k], cell.x, cell.y);
        }
        ctx.globalAlpha = 1;
      }

      if (reduced) {
        paint(ROWS, false);
        // repaint when the visitor switches between light and dark mode
        const mo = new MutationObserver(() => paint(ROWS, false));
        mo.observe(document.body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });
        const prevCleanup = cleanup;
        cleanup = () => { mo.disconnect(); prevCleanup(); };
        return;
      }

      // print row by row
      const PRINT_MS = 1500;
      const t0 = performance.now();
      function frame(now) {
        if (stopped) return;
        const p = Math.min(1, (now - t0) / PRINT_MS);
        paint(Math.floor(p * ROWS), false);
        if (p < 1) { raf = requestAnimationFrame(frame); return; }
        // idle: a few characters flicker, paused when the tab is hidden
        timer = setInterval(() => { if (!document.hidden) paint(ROWS, true); }, 160);
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
