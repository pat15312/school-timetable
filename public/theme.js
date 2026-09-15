// Apply appearance before the app renders, matching NetRevive's theme behaviour.
(() => {
  const key = "schoolcal.theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = (value) =>
    ["light", "dark"].includes(value) ? value : "system";
  let preference = "system";
  try {
    preference = normalize(localStorage.getItem(key));
  } catch {}

  const apply = () => {
    const theme =
      preference === "dark" || (preference === "system" && system.matches)
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = meta.dataset[theme];
    window.dispatchEvent(new Event("schoolcal:theme-applied"));
  };
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      preference = normalize(event.newValue);
      apply();
    }
  });
  window.addEventListener("schoolcal:theme-change", (event) => {
    preference = normalize(event.detail);
    try {
      if (preference === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch {}
    apply();
  });
})();
