import { test, expect, type Page } from "@playwright/test";

async function choose(page: Page, label: string) {
  await page.getByRole("button", { name: /^Appearance:/ }).click();
  await page
    .getByRole("button", { name: `${label} theme`, exact: true })
    .click();
}

test("appearance follows the device, persists overrides, syncs tabs, and supports keyboard controls", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const trigger = page.getByRole("button", { name: /^Appearance:/ });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "Auto theme", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("button", { name: "Dark theme", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAccessibleName("Appearance: Light");
  await expect(trigger).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(trigger).toHaveAccessibleName("Appearance: Light");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  // The expanded appearance menu can cover the heading's centre on phones.
  await page.locator("h1").click({ position: { x: 5, y: 5 } });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  const other = await context.newPage();
  await other.goto("./");
  await choose(other, "Dark");
  await expect(trigger).toHaveAccessibleName("Appearance: Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await choose(other, "Auto");
  await expect(trigger).toHaveAccessibleName("Appearance: Auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => localStorage.getItem("schoolcal.theme")),
  ).toBeNull();
  await other.close();
  await page.reload();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("saved appearance applies before React loads and still works without storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("schoolcal.theme", "dark");
    localStorage.setItem("schoolcal.colour", "#6d28d9");
  });
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/assets\/index-.*\.js$/, async (route) => {
    await paused;
    await route.continue();
  });
  try {
    await page.goto("./", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("#root")).toBeEmpty();
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-colour",
      "#6d28d9",
    );
    expect(
      await page
        .locator("html")
        .evaluate((node) =>
          (node as HTMLElement).style.getPropertyValue("--brand"),
        ),
    ).toBe("#6d28d9");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Appearance: Dark" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.removeItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await choose(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await choose(page, "Auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("dark appearance keeps print previews and PDFs on light paper", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible())
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Print timetable", exact: true })
    .click();
  const sheet = page.locator(".print-sheet").first();
  const colours = async () =>
    sheet.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        colour: style.color,
        scheme: style.colorScheme,
      };
    });
  const paper = {
    background: "rgb(255, 255, 255)",
    colour: "rgb(0, 0, 0)",
    scheme: "light",
  };
  expect(await colours()).toEqual(paper);
  await page.emulateMedia({ media: "print" });
  expect(await colours()).toEqual(paper);
  if (testInfo.project.name === "desktop-chromium") {
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
  }
});
