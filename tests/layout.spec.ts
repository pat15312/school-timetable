import { test, expect, type Page } from "@playwright/test";

async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}

test("date and time controls fit their forms at mobile and desktop widths", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  for (const width of mobile ? [320, 390, 430, 768] : [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go(page, "School year");
    for (const date of ["", "2026-09-07"]) {
      await page.getByLabel("First day of school").fill(date);
      const datesFit = await page
        .locator('input[type="date"]')
        .evaluateAll((inputs) =>
          inputs.every((input) => {
            const bounds = input.getBoundingClientRect();
            const parent = input.parentElement!.getBoundingClientRect();
            return (
              bounds.left >= parent.left - 1 &&
              bounds.right <= parent.right + 1 &&
              bounds.height >= 44
            );
          }),
        );
      expect(datesFit, `Date controls fit at ${width}px`).toBe(true);
    }
    await go(page, "Lesson times");
    const start = page.getByLabel("Registration start time", { exact: true });
    await start.fill("08:20");
    await expect(start).toHaveValue("08:20");
    const layout = await page.locator(".period-row").evaluateAll((rows) =>
      rows.map((row) => {
        const bounds = row.getBoundingClientRect();
        const controls = [...row.querySelectorAll("input, select")].map(
          (node) => node.getBoundingClientRect(),
        );
        const times = [...row.querySelectorAll('input[type="time"]')].map(
          (node) => node.getBoundingClientRect(),
        );
        return {
          fits: controls.every(
            (box) =>
              box.left >= bounds.left - 1 && box.right <= bounds.right + 1,
          ),
          gap: times[1].left - times[0].right,
          widthDifference: Math.abs(times[1].width - times[0].width),
        };
      }),
    );
    expect(
      layout.every(
        (row) =>
          row.fits && row.gap >= 7 && (!mobile || row.widthDifference <= 1),
      ),
      `Period layout at ${width}px`,
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: testInfo.outputPath(`periods-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
  }
});

test("navigation stays reachable while scrolling and subject outlines are not clipped", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  const palette = page.locator(".subject-palette");
  await page.getByRole("button", { name: "Maths", exact: true }).click();
  const ringFits = async () =>
    page.locator(".palette-subject.active").evaluate((node) => {
      const box = node.getBoundingClientRect();
      const scroller = node.parentElement!;
      const viewport = scroller.getBoundingClientRect();
      const style = getComputedStyle(node);
      const scrollStyle = getComputedStyle(scroller);
      const ring =
        parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      return (
        (scrollStyle.overflowX === "visible" ||
          (box.left - ring >= viewport.left - 1 &&
            box.right + ring <= viewport.right + 1)) &&
        (scrollStyle.overflowY === "visible" ||
          (box.top - ring >= viewport.top - 1 &&
            box.bottom + ring <= viewport.bottom + 1))
      );
    });
  expect(await ringFits()).toBe(true);
  if (mobile) {
    await page.locator(".palette-items").evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    await page.getByRole("button", { name: "History", exact: true }).click();
    expect(await ringFits()).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 700));
  const topbar = page.locator(".topbar");
  await expect
    .poll(async () => Math.round((await topbar.boundingBox())!.y))
    .toBe(0);
  if (mobile) {
    const header = (await topbar.boundingBox())!;
    expect((await palette.boundingBox())!.y).toBeGreaterThanOrEqual(
      header.height + 7,
    );
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Main navigation" }),
    ).toBeVisible();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "School year", exact: true })
      .click();
    await expect(page.getByLabel("Timetable name")).toBeVisible();
  }
  await page.getByRole("button", { name: /^Appearance:/ }).click();
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(async () => Math.round((await topbar.boundingBox())!.y))
    .toBe(0);
  await page.getByRole("button", { name: "Appearance: Dark" }).click();
  await expect(
    page.getByRole("button", { name: "Light theme", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("sticky-navigation-dark.png"),
    animations: "disabled",
  });
});
