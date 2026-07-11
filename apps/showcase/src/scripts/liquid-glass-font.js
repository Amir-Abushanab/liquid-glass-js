import { mountGlassText } from "@liquidglassjs/core";
document.querySelectorAll(".lgf__text").forEach((el) => {
  if (el.dataset.lgfMounted)
    return;
  el.dataset.lgfMounted = "1";
  // Soften the ~100ms filter pop-in (item 5): dim now — only ever via JS, so the
  // no-JS fallback never dims — then ease to full opacity when the glass lands.
  el.classList.add("is-pending");
  const clear = () => el.classList.remove("is-pending");
  const safety = setTimeout(clear, 1500); // don't strand it dimmed if fonts.ready hangs
  mountGlassText({
    target: el,
    host: el.closest(".lgf") ?? el,
    onReady: () => {
      clearTimeout(safety);
      clear();
    }
  });
});