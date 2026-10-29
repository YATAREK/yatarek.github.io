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
    const STEP_DEG = 6.2; // angular spacing per character
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
