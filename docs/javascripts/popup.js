// Opens links marked .js-popup (for example the Experience button) in a pop-up
// instead of navigating away. Falls back to a normal link if anything fails.
(function () {
  let dialog = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "popup";
    dialog.innerHTML =
      '<div class="popup__bar"><span class="popup__title"></span>' +
      '<button class="popup__close" type="button" aria-label="Close">×</button></div>' +
      '<div class="popup__body md-typeset"></div>';
    dialog.querySelector(".popup__close").addEventListener("click", () => dialog.close());
    // click on the backdrop closes it
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    return dialog;
  }

  async function open(link) {
    const url = new URL(link.getAttribute("href"), location.href);
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const content = doc.querySelector(".md-content__inner");
    if (!content) throw new Error("no content");
    // make relative image and link paths work from this page
    content.querySelectorAll("img[src], a[href]").forEach((el) => {
      const attr = el.tagName === "IMG" ? "src" : "href";
      const v = el.getAttribute(attr);
      if (v && !/^(https?:|mailto:|#)/.test(v)) el.setAttribute(attr, new URL(v, url).href);
    });
    const d = ensureDialog();
    d.querySelector(".popup__title").textContent = link.textContent.trim();
    const body = d.querySelector(".popup__body");
    body.innerHTML = "";
    body.append(...content.childNodes);
    body.scrollTop = 0;
    d.showModal();
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.js-popup");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (typeof HTMLDialogElement !== "function") return; // old browser: normal link
    e.preventDefault();
    e.stopPropagation();
    open(link).catch(() => { location.href = link.href; });
  }, true);
})();
