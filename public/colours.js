// Shared by the early appearance script and palette validation tests.
(() => {
  const defaultColour = "#285da8";
  const normalise = (value) =>
    typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : defaultColour;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const hex = (values) =>
    `#${values.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
  const mix = (from, to, amount) =>
    hex(rgb(from).map((value, i) => value + (rgb(to)[i] - value) * amount));
  const luminance = (colour) => {
    const channels = rgb(colour).map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const first = luminance(a),
      second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const readable = (colour, backgrounds, target, minimum) => {
    for (let step = 0; step <= 100; step++) {
      const candidate = mix(colour, target, step / 100);
      if (
        backgrounds.every(
          (background) => contrast(candidate, background) >= minimum,
        )
      )
        return candidate;
    }
    return target;
  };
  const palette = (value, dark) => {
    const colour = normalise(value);
    const [r, g, b] = rgb(colour).map((channel) => channel / 255);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const delta = max - min,
      lightness = (max + min) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    const hue =
      delta === 0
        ? 0
        : ((max === r
            ? (g - b) / delta
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4) +
            6) %
          6;
    const tone = (light, strength = 0.5) => {
      const chroma =
        (1 - Math.abs(2 * light - 1)) * Math.min(saturation, 0.8) * strength;
      const x = chroma * (1 - Math.abs((hue % 2) - 1));
      const channels = [
        [chroma, x, 0],
        [x, chroma, 0],
        [0, chroma, x],
        [0, x, chroma],
        [x, 0, chroma],
        [chroma, 0, x],
      ][Math.floor(hue)];
      return hex(channels.map((c) => (c + light - chroma / 2) * 255));
    };
    const surface = dark ? tone(0.12) : "#ffffff";
    const canvas = tone(dark ? 0.08 : 0.977, dark ? 0.7 : 0.4);
    const sidebar = tone(dark ? 0.1 : 0.993);
    const soft = tone(dark ? 0.16 : 0.96);
    const accent = tone(dark ? 0.22 : 0.925, 0.75);
    const backgrounds = [surface, canvas, sidebar, soft, accent];
    const target = dark ? "#ffffff" : "#000000";
    let action = readable(colour, ["#ffffff"], "#000000", 5.2);
    if (dark) action = readable(action, [canvas], "#ffffff", 3);
    const primary = readable(colour, backgrounds, target, 4.8);
    const ink = readable(tone(dark ? 0.94 : 0.16, 0.3), backgrounds, target, 7);
    const muted = readable(
      tone(dark ? 0.75 : 0.36, 0.25),
      backgrounds,
      target,
      4.8,
    );
    return {
      "--brand": colour,
      "--on-brand":
        contrast(colour, "#ffffff") >= contrast(colour, "#000000")
          ? "#ffffff"
          : "#000000",
      "--primary": primary,
      "--action": action,
      "--action-hover": mix(action, "#000000", 0.15),
      "--on-action": "#ffffff",
      "--ink": ink,
      "--muted": muted,
      "--canvas": canvas,
      "--surface": surface,
      "--sidebar-surface": sidebar,
      "--topbar-surface": sidebar,
      "--soft": soft,
      "--accent-soft": accent,
      "--line": tone(dark ? 0.27 : 0.87, 0.3),
      "--input-line": readable(
        tone(dark ? 0.43 : 0.64, 0.3),
        [surface],
        target,
        3,
      ),
      "--line-strong": tone(dark ? 0.55 : 0.58, 0.5),
      "--focus": readable(colour, backgrounds, target, 3.2),
      "--toast-bg": action,
      "--shadow-rgb": rgb(tone(0.08, 0.4)).join(" "),
      "--backdrop": `${tone(0.06, 0.4)}${dark ? "b3" : "66"}`,
    };
  };
  window.schoolcalColours = { defaultColour, normalise, palette };
})();
