import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const context = {
  window: {} as {
    schoolcalColours?: {
      defaultColour: string;
      normalise: (colour: unknown) => string;
      palette: (colour: string, dark: boolean) => Record<string, string>;
    };
  },
};
runInNewContext(
  readFileSync(new URL("../../public/colours.js", import.meta.url), "utf8"),
  context,
);
const colours = context.window.schoolcalColours!;
function luminance(hex: string) {
  const rgb = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("generated app colours", () => {
  it("accepts a single hex colour and rejects malformed saved preferences", () => {
    expect(colours.normalise("#Ab12F0")).toBe("#ab12f0");
    for (const input of [
      null,
      undefined,
      {},
      "red",
      "#fff",
      "#12345678",
      "#gg1234",
      "url(https://example.com)",
    ])
      expect(colours.normalise(input)).toBe(colours.defaultColour);
  });
  for (const dark of [false, true]) {
    it(`keeps text, buttons, focus and input outlines readable for the RGB gamut in ${dark ? "dark" : "light"} mode`, () => {
      const channels = [0, 51, 102, 153, 204, 255];
      const samples = channels.flatMap((r) =>
        channels.flatMap((g) =>
          channels.map(
            (b) =>
              `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
          ),
        ),
      );
      samples.push("#285da8", "#34745c", "#7c3aed", "#ef4444", "#facc15");
      for (const colour of samples) {
        const p = colours.palette(colour, dark);
        expect(p["--brand"]).toBe(colour);
        expect(
          ratio(p["--brand"], p["--on-brand"]),
          `Logo on ${colour}`,
        ).toBeGreaterThanOrEqual(4.5);
        for (const background of [
          "--surface",
          "--canvas",
          "--sidebar-surface",
          "--soft",
          "--accent-soft",
        ]) {
          for (const text of ["--ink", "--muted", "--primary"])
            expect(
              ratio(p[text], p[background]),
              `${colour}: ${text} on ${background}`,
            ).toBeGreaterThanOrEqual(4.5);
          expect(
            ratio(p["--focus"], p[background]),
            `${colour}: focus on ${background}`,
          ).toBeGreaterThanOrEqual(3);
        }
        for (const button of ["--action", "--action-hover", "--toast-bg"])
          expect(
            ratio(p[button], p["--on-action"]),
            `${colour}: ${button}`,
          ).toBeGreaterThanOrEqual(4.5);
        expect(ratio(p["--input-line"], p["--surface"])).toBeGreaterThanOrEqual(
          3,
        );
      }
    });
  }
});
