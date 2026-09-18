import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";
import AxeBuilder from "@axe-core/playwright";
import { sampleProject } from "../src/domain/fixture";
import {
  parseProject,
  serializeProject,
  STORAGE_KEY,
} from "../src/domain/persistence";

async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}

async function saved(page: Page) {
  return parseProject(
    await page.evaluate((key) => localStorage.getItem(key)!, STORAGE_KEY),
  );
}

test("duplicate and reorder subjects independently, persist their order, and place and export both teachers", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await go(page, "Subjects");
  const before = await saved(page);
  const original = before.subjects[0];
  const duplicate = page.getByRole("button", {
    name: "Duplicate Mathematics",
    exact: true,
  });
  await duplicate.click();
  await expect(
    page.getByRole("dialog", { name: "Duplicate Mathematics" }),
  ).toBeVisible();
  await expect(page.getByLabel("Subject name", { exact: true })).toHaveValue(
    original.name,
  );
  await expect(page.getByLabel("Short name (optional)")).toHaveValue(
    original.shortName!,
  );
  await expect(page.getByLabel("Default teacher (optional)")).toHaveValue(
    original.teacher!,
  );
  await expect(page.getByLabel("Default room (optional)")).toHaveValue(
    original.room!,
  );
  await expect(page.getByLabel("Custom subject colour")).toHaveValue(
    original.colour,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await saved(page)).subjects).toEqual(before.subjects);

  await duplicate.click();
  await page.getByLabel("Default teacher (optional)").fill("Mr Lewis");
  await page.getByLabel("Default room (optional)").fill("M14");
  await page.getByRole("button", { name: "Save subject" }).click();
  await expect(page.locator(".subject-card")).toHaveCount(7);
  const copy = (await saved(page)).subjects[1];
  expect(copy).toEqual({
    ...original,
    id: expect.any(String),
    teacher: "Mr Lewis",
    room: "M14",
  });
  expect(copy.id).not.toBe(original.id);
  const card = page
    .getByRole("article", { name: "Mathematics", exact: true })
    .filter({ hasText: "Mr Lewis" });
  const up = card.getByRole("button", { name: "Move Mathematics up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".subject-card").first()).toContainText("Mr Lewis");
  await expect(up).toBeDisabled();
  await card.getByRole("button", { name: "Move Mathematics down" }).click();
  await expect(page.locator(".subject-card").nth(1)).toContainText("Mr Lewis");
  await up.click();
  await card.getByRole("button", { name: "Edit Mathematics" }).click();
  await page.getByLabel("Default room (optional)").fill("M18");
  await page.getByRole("button", { name: "Save subject" }).click();
  await expect(page.locator(".subject-card").first()).toContainText("M18");
  await expect(
    page.getByRole("button", { name: "Move History down" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Move History up" }).click();
  await page.getByRole("button", { name: "Move History down" }).click();
  const expectedOrder = [copy.id, ...before.subjects.map((s) => s.id)];
  const after = await saved(page);
  expect(after.subjects.map((s) => s.id)).toEqual(expectedOrder);
  expect(after.subjects[1]).toEqual(original);
  expect(after.entries).toEqual(before.entries);
  await page.reload();
  await expect(page.locator(".subject-card").first()).toContainText(
    "Mr Lewis · M18",
  );
  expect((await saved(page)).subjects.map((s) => s.id)).toEqual(expectedOrder);

  await go(page, "My timetable");
  const palette = page.locator(".palette-subject");
  await expect(palette.first()).toContainText("Mr Lewis · M18");
  await expect(palette.nth(1)).toContainText("Mrs Jones · M12");
  const grid = page.locator(
    ".desktop-timetable:visible, .mobile-timetable:visible",
  );
  const originalCell = grid.getByRole("button", {
    name: "Monday Period 1, Mathematics",
    exact: true,
  });
  await expect(originalCell).toContainText("Mrs Jones");
  await expect(originalCell).toContainText("M12");
  await page
    .getByRole("button", { name: "Maths Mr Lewis · M18", exact: true })
    .click();
  await expect(page.locator(".tool-status")).toContainText("Mr Lewis · M18");
  await grid.getByRole("button", { name: /^Monday Period 2,/ }).click();
  const newCell = grid.getByRole("button", {
    name: "Monday Period 2, Mathematics",
    exact: true,
  });
  await expect(newCell).toContainText("Mr Lewis");
  await expect(newCell).toContainText("M18");
  await expect(originalCell).toContainText("Mrs Jones");
  await page.screenshot({
    path: testInfo.outputPath("subject-variants.png"),
    animations: "disabled",
  });
  await go(page, "Export & share");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download calendar", exact: true })
    .click();
  const calendar = new ICAL.Component(
    ICAL.parse(await readFile((await (await downloading).path())!, "utf8")),
  );
  const events = calendar
    .getAllSubcomponents("vevent")
    .map((event) => new ICAL.Event(event));
  const first = events.find(
    (e) => e.startDate.toString() === "2026-09-07T08:45:00",
  )!;
  const second = events.find(
    (e) => e.startDate.toString() === "2026-09-07T09:45:00",
  )!;
  expect([first.summary, second.summary]).toEqual([
    "Mathematics",
    "Mathematics",
  ]);
  expect(first.location).toBe("M12");
  expect(first.description).toContain("Teacher: Mrs Jones");
  expect(second.location).toBe("M18");
  expect(second.description).toContain("Teacher: Mr Lewis");
});

test("subject controls and variant labels fit narrow and wide screens in both themes", async ({
  page,
}, testInfo) => {
  const project = sampleProject();
  project.subjects.splice(1, 0, {
    ...project.subjects[0],
    id: "maths-copy",
    teacher: "Dr Alexandra Richardson",
    room: "Science building, room 204",
  });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: serializeProject(project) },
  );
  await page.goto("./");
  const mobile = testInfo.project.name.startsWith("mobile");
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of mobile ? [320, 390, 768] : [1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await go(page, "Subjects");
      const fit = await page.locator(".subject-card").evaluateAll((cards) =>
        cards.every((card) => {
          const bounds = card.getBoundingClientRect();
          return [...card.querySelectorAll("button")].every((button) => {
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
      expect(fit, `${theme} controls at ${width}px`).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(`subjects-${theme}.png`),
          animations: "disabled",
        });
      await go(page, "My timetable");
      await page
        .getByRole("button", {
          name: "Maths Dr Alexandra Richardson · Science building, room 204",
          exact: true,
        })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const labelFits = await page
        .locator(".palette-subject.active")
        .evaluate((button) => {
          const label = button.querySelector(".palette-subject-label")!;
          return (
            label.scrollWidth <= label.clientWidth + 1 &&
            button.getBoundingClientRect().width < innerWidth - 50
          );
        });
      expect(labelFits, `${theme} variant label at ${width}px`).toBe(true);
    }
    if (testInfo.project.name.endsWith("chromium")) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await go(page, "Subjects");
      await page
        .getByRole("button", { name: "Duplicate Mathematics", exact: true })
        .nth(1)
        .click();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
});
