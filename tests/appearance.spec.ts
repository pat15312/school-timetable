import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ timeout: 90_000 });

async function openAppearance(page: Page) {
  const trigger = page.getByRole("button", { name: /^Appearance:/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}
async function pickColour(page: Page, colour: string) {
  await openAppearance(page);
  // Native colour dialogs are supplied by the OS. Deliver the same input/change
  // events that selecting a colour sends, exercising the actual React control.
  await page
    .getByLabel("App colour", { exact: true })
    .evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, colour);
  await expect(page.locator("html")).toHaveAttribute("data-app-colour", colour);
}
async function theme(page: Page, label: string) {
  await openAppearance(page);
  await page
    .getByRole("button", { name: `${label} theme`, exact: true })
    .click();
}
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}

test("one app colour updates the logo and both themes, persists, syncs tabs, resets and works without storage", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await pickColour(page, "#34745c");
  await expect(page.locator(".brand-mark")).toHaveCSS(
    "background-color",
    "rgb(52, 116, 92)",
  );
  expect(
    decodeURIComponent(
      (await page.locator('link[rel="icon"]').getAttribute("href")) || "",
    ),
  ).toContain('fill="#34745c"');
  const canvas = await page
    .locator("html")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await theme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-colour",
    "#34745c",
  );
  expect(
    await page
      .locator("html")
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(canvas);
  await page.reload();
  await openAppearance(page);
  await expect(page.getByLabel("App colour", { exact: true })).toHaveValue(
    "#34745c",
  );
  await expect(
    page.getByRole("button", { name: "Dark theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const other = await context.newPage();
  await other.goto("./");
  await pickColour(other, "#facc15");
  await expect(page.getByLabel("App colour", { exact: true })).toHaveValue(
    "#facc15",
  );
  await expect(page.locator(".brand-mark")).toHaveCSS("color", "rgb(0, 0, 0)");
  await other.getByRole("button", { name: "Reset app colour to blue" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-colour",
    "#285da8",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("schoolcal.colour")),
  ).toBeNull();
  await other.close();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.removeItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await pickColour(page, "#7c3aed");
  await theme(page, "Light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-colour",
    "#7c3aed",
  );
});

test("custom light and dark palettes keep the appearance menu, timetable and export accessible", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.endsWith("webkit"),
    "Axe colour checks run in Chromium; interactions and print run in both engines.",
  );
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  for (const [mode, colour] of [
    ["Light", "#facc15"],
    ["Dark", "#7c3aed"],
  ]) {
    await theme(page, mode);
    await pickColour(page, colour);
    for (const view of ["Appearance", "My timetable", "Export & share"]) {
      if (view !== "Appearance") {
        await page.keyboard.press("Escape");
        await go(page, view);
      }
      // Theme changes animate button backgrounds for 150 ms. Measure the
      // settled palette rather than an intermediate light-to-dark frame.
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.getTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          rule: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            reason: n.failureSummary,
          })),
        })),
        `${mode} ${view}`,
      ).toEqual([]);
    }
    await page.screenshot({
      path: testInfo.outputPath(`custom-${mode.toLowerCase()}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("print previews and both PDF layouts stay monochrome with subject accents for every app appearance", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await pickColour(page, "#e11d48");
  await theme(page, "Light");
  await go(page, "Print timetable");
  const sheet = page.locator(".print-sheet").first();
  const inspect = () =>
    sheet.evaluate((node) => {
      const all = [node, ...node.querySelectorAll("*")];
      const grey = (value: string) => {
        const channels = value.match(/[\d.]+/g)?.map(Number) || [];
        return (
          channels[3] === 0 ||
          (channels[0] === channels[1] && channels[1] === channels[2])
        );
      };
      return {
        whitePaper:
          getComputedStyle(node).backgroundColor === "rgb(255, 255, 255)",
        blackText: getComputedStyle(node).color === "rgb(0, 0, 0)",
        neutral: all.every((element) => {
          const style = getComputedStyle(element);
          return (
            grey(style.color) &&
            grey(style.backgroundColor) &&
            (element.matches(".print-subject") ||
              [style.borderTopColor, style.borderLeftColor].every(grey))
          );
        }),
        subjectColours: [
          ...node.querySelectorAll<HTMLElement>(
            ".print-week:first-child .print-subject",
          ),
        ].map((cell) => ({
          colour: getComputedStyle(cell).borderLeftColor,
          background: cell.style.backgroundColor,
        })),
      };
    });
  const initial = await inspect();
  expect(initial.whitePaper && initial.blackText && initial.neutral).toBe(true);
  expect(initial.subjectColours.length).toBeGreaterThan(0);
  expect(initial.subjectColours.every((cell) => cell.background === "")).toBe(
    true,
  );
  expect(
    new Set(initial.subjectColours.map((cell) => cell.colour)).size,
  ).toBeGreaterThan(1);
  await pickColour(page, "#facc15");
  await theme(page, "Dark");
  expect(await inspect()).toEqual(initial);
  for (const [label, count] of [
    ["One week per page", 2],
    ["Two weeks per page", 1],
  ] as const) {
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("radio", { name: new RegExp(label) }).check();
    await page.emulateMedia({ media: "print" });
    const printed = await inspect();
    expect(printed.whitePaper && printed.blackText && printed.neutral).toBe(
      true,
    );
    expect(printed.subjectColours).toEqual(initial.subjectColours);
    if (testInfo.project.name === "desktop-chromium") {
      const pdf = await page.pdf({
        path: testInfo.outputPath(`ink-saving-${count}-pages.pdf`),
        preferCSSPageSize: true,
        printBackground: true,
      });
      expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(
        count,
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`ink-saving-${count}-pages.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});
