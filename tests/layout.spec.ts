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

test("pages share content edges and export stays in the main flow across screen sizes", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const mobile = testInfo.project.name.startsWith("mobile");
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  const pages = [
    ["School year", ".year-form"],
    ["Timetable rotation", ".settings-page > .panel"],
    ["Holidays & days off", ".holiday-list"],
    ["Lesson times", ".periods-panel"],
    ["Subjects", ".subject-cards"],
    ["My timetable", ".editor-heading"],
    ["Print timetable", ".print-controls"],
    ["Calendar overview", ".review-summary"],
    ["Lesson preview", ".calendar-preview"],
    ["Export & share", ".export-card"],
  ];
  for (const [index, width] of (mobile ? [320, 768] : [1280, 1920]).entries()) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: index ? "dark" : "light" });
    let sharedEdges: { x: number; width: number } | undefined;
    for (const [name, selector] of pages) {
      await go(page, name);
      const heading = (await page.locator(".page-heading").boundingBox())!;
      const content = (await page.locator(selector).boundingBox())!;
      sharedEdges ??= heading;
      for (const box of [
        heading,
        content,
        (await page.locator(".app-footer").boundingBox())!,
      ]) {
        expect(
          Math.abs(box.x - sharedEdges.x),
          `${name}: left edge at ${width}px`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(box.width - sharedEdges.width),
          `${name}: width at ${width}px`,
        ).toBeLessThanOrEqual(1);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${name}: no page overflow at ${width}px`,
      ).toBe(true);
    }
    const heading = (await page.locator(".page-heading").boundingBox())!;
    if (!mobile) {
      const breadcrumb = (await page.locator(".breadcrumb").boundingBox())!;
      const appearance = (await page
        .getByRole("button", { name: /^Appearance:/ })
        .boundingBox())!;
      expect(Math.abs(breadcrumb.x - heading.x)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(appearance.x + appearance.width - heading.x - heading.width),
      ).toBeLessThanOrEqual(1);
    }
    for (const selector of [".export-card", ".transfer-card", ".backup-card"]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(Math.abs(box.x - heading.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - heading.width)).toBeLessThanOrEqual(1);
    }
    const exportPanel = (await page.locator(".export-card").boundingBox())!;
    const preview = (await page.locator(".transfer-card").boundingBox())!;
    expect(preview.y - exportPanel.y - exportPanel.height).toBeCloseTo(24, 0);
    await go(page, "Lesson preview");
    const filters = await page
      .locator(".preview-filters .field")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
    if (mobile)
      expect(filters[1].y).toBeGreaterThan(filters[0].y + filters[0].height);
    else {
      expect(filters[1].y).toBe(filters[0].y);
      expect(Math.abs(filters[1].width - filters[0].width)).toBeLessThanOrEqual(
        1,
      );
    }
    expect(
      await page
        .locator(
          ".preview-filters input, .preview-filters select, .preview-filters button",
        )
        .evaluateAll((nodes) =>
          nodes.every((node) => {
            const box = node.getBoundingClientRect();
            const field = node.closest(".field")!.getBoundingClientRect();
            return (
              box.height >= 44 &&
              box.left >= field.left - 1 &&
              box.right <= field.right + 1
            );
          }),
        ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`consistent-layout-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await go(page, "Export & share");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download calendar", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.ics$/);
});

test("short and long pages keep the same position when the document scrollbar appears", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Desktop document scrollbars",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await go(page, "School year");
  const measure = () =>
    page.evaluate(() => {
      const heading = document
        .querySelector(".page-heading")!
        .getBoundingClientRect();
      const appearance = document
        .querySelector(".theme-trigger")!
        .getBoundingClientRect();
      return {
        x: heading.x,
        width: heading.width,
        appearance: appearance.x,
        scrolling:
          document.documentElement.scrollHeight >
          document.documentElement.clientHeight,
      };
    });
  const short = await measure();
  expect(short.scrolling).toBe(false);
  await go(page, "Holidays & days off");
  const long = await measure();
  expect(long.scrolling).toBe(true);
  expect({ ...long, scrolling: false }).toEqual(short);
  await go(page, "School year");
  expect(await measure()).toEqual(short);
});
