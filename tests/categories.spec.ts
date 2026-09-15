import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";
import AxeBuilder from "@axe-core/playwright";
import { sampleProject } from "../src/domain/fixture";
import { STORAGE_KEY, parseProject } from "../src/domain/persistence";

async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function manage(page: Page) {
  await go(page, "Lesson times");
  await page
    .getByRole("button", { name: "Period categories", exact: true })
    .click();
}
async function saved(page: Page) {
  return parseProject(
    await page.evaluate((key) => localStorage.getItem(key)!, STORAGE_KEY),
  );
}
async function calendar(page: Page) {
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Calendar (.ics)", exact: true })
    .click();
  const component = new ICAL.Component(
    ICAL.parse(await readFile((await (await downloading).path())!, "utf8")),
  );
  return component
    .getAllSubcomponents("vevent")
    .map((event) => new ICAL.Event(event));
}

test("manage categories, apply their subject flag everywhere, restore lessons, and replace a category before deleting it", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  const originalEntries = (await saved(page)).entries;
  await manage(page);
  await expect(page.locator(".category-row")).toHaveCount(4);
  await expect(
    page.getByRole("switch", {
      name: "Allow subjects for Lesson",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", {
      name: "Allow subjects for Registration",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Edit Registration category" })
    .click();
  await page.getByLabel("Category name", { exact: true }).fill("Tutor period");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(
    page.getByRole("switch", {
      name: "Allow subjects for Tutor period",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Study session");
  await page.getByRole("switch", { name: /^Allow subjects/ }).check();
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Period 1 label", { exact: true })).toHaveValue(
    "Tutor period",
  );
  await expect(
    page.getByLabel("Tutor period category", { exact: true }).locator("option"),
  ).toHaveText(["Lesson", "Tutor period", "Break", "Lunch", "Study session"]);
  for (const name of ["Period 1", "Period 2"])
    await page
      .getByLabel(`${name} category`, { exact: true })
      .selectOption({ label: "Study session" });
  await go(page, "My timetable");
  const grid = page.locator(
    ".desktop-timetable:visible, .mobile-timetable:visible",
  );
  await expect(
    grid.getByRole("button", {
      name: "Monday Period 1, Mathematics",
      exact: true,
    }),
  ).toContainText("Mrs Jones");
  await manage(page);
  await page
    .getByRole("switch", {
      name: "Allow subjects for Study session",
      exact: true,
    })
    .uncheck();
  await page.screenshot({
    path: testInfo.outputPath("period-categories.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await go(page, "My timetable");
  await expect(
    grid.getByRole("button", { name: /^Monday Period [12],/ }),
  ).toHaveCount(0);
  await expect(
    grid.locator(".structural-row, .mobile-period.structural"),
  ).toHaveCount(5);
  await page.getByRole("tab", { name: "Week 2", exact: true }).click();
  await expect(
    grid.getByRole("button", { name: /^Monday Period [12],/ }),
  ).toHaveCount(0);
  expect((await saved(page)).entries).toEqual(originalEntries);
  await go(page, "Print timetable");
  await expect(page.locator(".print-structural")).toHaveCount(10);
  await go(page, "Calendar & export");
  const lessons = await calendar(page);
  expect(
    lessons.some((event) => event.startDate.toString().endsWith("T08:45:00")),
  ).toBe(false);
  await page.getByRole("checkbox", { name: /Include fixed periods/ }).check();
  const fixed = (await calendar(page)).find(
    (event) => event.startDate.toString() === "2026-09-07T08:45:00",
  )!;
  expect(fixed.summary).toBe("Period 1");
  expect(fixed.location || "").toBe("");
  expect(fixed.description || "").not.toContain("Mrs Jones");
  await manage(page);
  await page
    .getByRole("switch", {
      name: "Allow subjects for Study session",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await go(page, "My timetable");
  await expect(
    grid.getByRole("button", {
      name: "Monday Period 1, Mathematics",
      exact: true,
    }),
  ).toContainText("Mrs Jones");
  await manage(page);
  await page
    .getByRole("button", { name: "Delete Study session category" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "2 periods use this category",
  );
  await page
    .getByRole("combobox", { name: "Replacement category", exact: true })
    .selectOption("lesson");
  await page
    .getByRole("button", { name: "Replace and delete", exact: true })
    .click();
  await expect(page.locator(".category-row")).toHaveCount(4);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  for (const name of ["Period 1", "Period 2"])
    await expect(
      page.getByLabel(`${name} category`, { exact: true }),
    ).toHaveValue("lesson");
  await expect(
    page.getByLabel("Tutor period category", { exact: true }).locator("option"),
  ).toHaveText(["Lesson", "Tutor period", "Break", "Lunch"]);
  expect((await saved(page)).entries).toEqual(originalEntries);
});

test("old backups upgrade, custom categories populate the dropdown, and their controls work in dark mobile and desktop layouts", async ({
  page,
}, testInfo) => {
  const { periodCategories: _, ...original } = sampleProject();
  const legacy = {
    schemaVersion: 1,
    timetable: {
      ...original,
      periods: original.periods.map(({ categoryId, ...period }) => ({
        ...period,
        type: categoryId,
      })),
    },
  };
  legacy.timetable.periods[1].type = "other";
  legacy.timetable.periods[1].name = "Supervised study";
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(legacy) },
  );
  await page.emulateMedia({ colorScheme: "dark" });
  if (testInfo.project.name.startsWith("mobile"))
    await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("./");
  await manage(page);
  await expect(page.locator(".category-row")).toHaveCount(4);
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill(" lesson ");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.getByLabel("Category name", { exact: true }).fill("Assembly");
  await expect(
    page.getByRole("switch", { name: /^Allow subjects/ }),
  ).not.toBeChecked();
  if (testInfo.project.name.endsWith("chromium"))
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  const fit = await page.locator(".category-row").evaluateAll((rows) =>
    rows.every((row) => {
      const bounds = row.getBoundingClientRect();
      return [...row.querySelectorAll("button")].every((button) => {
        const box = button.getBoundingClientRect();
        return (
          box.left >= bounds.left &&
          box.right <= bounds.right &&
          box.width >= 44 &&
          box.height >= 44
        );
      });
    }),
  );
  expect(fit).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("categories-dark.png"),
    animations: "disabled",
  });
  if (testInfo.project.name.endsWith("chromium"))
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByLabel("Supervised study category", { exact: true }),
  ).toHaveValue("lesson");
  await expect(
    page.getByLabel("Registration category", { exact: true }).locator("option"),
  ).toHaveText(["Lesson", "Registration", "Break", "Lunch", "Assembly"]);
  await page.getByRole("button", { name: "Add period", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a period" });
  await dialog
    .getByLabel("Period category")
    .selectOption({ label: "Assembly" });
  await expect(dialog.getByLabel("Period name", { exact: true })).toHaveValue(
    "Assembly",
  );
  await dialog.getByLabel("Start time", { exact: true }).fill("15:00");
  await dialog.getByLabel("End time", { exact: true }).fill("15:15");
  await dialog.getByRole("button", { name: "Save period" }).click();
  await manage(page);
  await page.getByRole("button", { name: "Edit Assembly category" }).click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Afternoon assembly");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Unused category");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Unused category category" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No periods use this category",
  );
  await page
    .getByRole("button", { name: "Delete category", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await go(page, "My timetable");
  const grid = page.locator(
    ".desktop-timetable:visible, .mobile-timetable:visible",
  );
  await expect(
    grid.getByRole("button", {
      name: "Monday Supervised study, Mathematics",
      exact: true,
    }),
  ).toContainText("Mrs Jones");
  await expect(
    grid
      .locator(".structural-row, .mobile-period.structural")
      .filter({ hasText: "Afternoon assembly" }),
  ).toContainText("15:15");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const downloading = page.waitForEvent("download");
  await go(page, "Back up project");
  const backup = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(backup.schemaVersion).toBe(2);
  expect(
    backup.timetable.periodCategories.some(
      (category: { name: string; allowSubjects: boolean }) =>
        category.name === "Afternoon assembly" && !category.allowSubjects,
    ),
  ).toBe(true);
  expect(backup.timetable.entries).toEqual(original.entries);
  await page.reload();
  await expect(
    grid
      .locator(".structural-row, .mobile-period.structural")
      .filter({ hasText: "Afternoon assembly" }),
  ).toBeVisible();
});
