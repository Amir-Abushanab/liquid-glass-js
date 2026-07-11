const KEY = "ps-theme";
function current() {
  const t = localStorage.getItem(KEY);
  return t === "light" || t === "dark" ? t : "system";
}
function reflect(choice) {
  document.querySelectorAll(".ps-theme").forEach((el) => {
    el.dataset.active = choice;
    el.querySelectorAll(".ps-theme__btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.set === choice));
    });
  });
}
function apply(choice) {
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (choice === "system") {
    localStorage.removeItem(KEY);
    delete root.dataset.theme;
    if (meta)
      meta.setAttribute("content", "light dark");
  } else {
    localStorage.setItem(KEY, choice);
    root.dataset.theme = choice;
    if (meta)
      meta.setAttribute("content", choice);
  }
  reflect(choice);
}
function init() {
  reflect(current());
  document.querySelectorAll(".ps-theme__btn").forEach((b) => {
    b.addEventListener("click", () => apply(b.dataset.set || "system"));
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (current() === "system")
      reflect("system");
  });
}
init();