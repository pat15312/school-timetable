// Apply appearance before the app renders, matching NetRevive's theme behaviour.
(() => {
  const key = "schoolcal.theme";
  const colourKey = "schoolcal.colour";
  const colours = window.schoolcalColours;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const normalise = (value) =>
    ["light", "dark"].includes(value) ? value : "system";
  let preference = "system";
  let colour = colours.defaultColour;
  try {
    preference = normalise(localStorage.getItem(key));
    colour = colours.normalise(localStorage.getItem(colourKey));
  } catch {}

  const apply = () => {
    const theme =
      preference === "dark" || (preference === "system" && system.matches)
        ? "dark"
        : "light";
    const root = document.documentElement;
    const palette = colours.palette(colour, theme === "dark");
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.dataset.appColour = colour;
    for (const [name, value] of Object.entries(palette))
      root.style.setProperty(name, value);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.content =
        theme === "dark" ? palette["--canvas"] : palette["--action"];
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="29" fill="${colour}"/><g fill="none" stroke="${palette["--on-brand"]}" stroke-width="7" stroke-linejoin="round"><rect x="31" y="31" width="66" height="66" rx="9"/><path d="M31 54h66M54 54v43"/></g><rect x="65" y="65" width="21" height="20" rx="4" fill="${palette["--on-brand"]}" fill-opacity=".5"/></svg>`;
      icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    window.dispatchEvent(new Event("schoolcal:theme-applied"));
  };
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null)
      preference = normalise(event.newValue);
    if (event.key === colourKey || event.key === null)
      colour = colours.normalise(event.newValue);
    if ([key, colourKey, null].includes(event.key)) apply();
  });
  window.addEventListener("schoolcal:theme-change", (event) => {
    preference = normalise(event.detail);
    try {
      if (preference === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch {}
    apply();
  });
  window.addEventListener("schoolcal:colour-change", (event) => {
    colour = colours.normalise(event.detail);
    try {
      if (colour === colours.defaultColour) localStorage.removeItem(colourKey);
      else localStorage.setItem(colourKey, colour);
    } catch {}
    apply();
  });
})();
