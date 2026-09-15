// Development-only: rasterise the code-native brand icon. PNG outputs are committed.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const svg = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch();
try {
  for (const size of [192, 512, 180]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px">${svg}</body></html>`,
    );
    await page.screenshot({
      path: new URL(
        `../public/${size === 180 ? "apple-touch-icon" : `icon-${size}`}.png`,
        import.meta.url,
      ).pathname,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
