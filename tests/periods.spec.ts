import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";
import AxeBuilder from "@axe-core/playwright";
import { sampleProject } from "../src/domain/fixture";
import { serializeProject, STORAGE_KEY } from "../src/domain/persistence";

async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}

async function downloadEvents(page: Page) {
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download calendar", exact: true })
    .click();
  const calendar = new ICAL.Component(
    ICAL.parse(await readFile((await (await downloading).path())!, "utf8")),
  );
  return calendar
    .getAllSubcomponents("vevent")
    .map((event) => new ICAL.Event(event));
}

test("registration is fixed, renamed periods persist, and an afternoon break is added, printed, exported and deleted", async ({
  page,
}, testInfo) => {
  const project = sampleProject();
  project.entries.push({
    id: "legacy-registration",
    rotationIndex: 0,
    weekday: 1,
    periodId: project.periods[0].id,
    subjectId: project.subjects[0].id,
    titleOverride: "Legacy registration subject",
    teacherOverride: "Legacy teacher",
    roomOverride: "Legacy room",
  });
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: serializeProject(project) },
  );
  await page.goto("./");
  const grid = page.locator(
    ".desktop-timetable:visible, .mobile-timetable:visible",
  );
  const fixed = grid.locator(".structural-row, .mobile-period.structural");
  await expect(fixed).toHaveCount(3);
  await expect(
    grid.getByRole("button", { name: /Monday Registration/ }),
  ).toHaveCount(0);
  await expect(grid).not.toContainText("Legacy registration subject");
  await page.getByRole("button", { name: "Maths", exact: true }).click();
  await fixed.getByText("Registration", { exact: true }).last().click();
  await expect(fixed).toHaveCount(3);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).timetable.entries,
      STORAGE_KEY,
    ),
  ).toEqual(project.entries);

  await go(page, "Lesson times");
  await page.getByLabel("Period 1 label", { exact: true }).fill("Tutor period");
  await page
    .getByLabel("Tutor period start time", { exact: true })
    .fill("08:20");
  await page.getByLabel("Tutor period end time", { exact: true }).fill("08:40");
  await expect(
    page.getByLabel("Tutor period category", { exact: true }),
  ).toHaveValue("registration");
  await page.getByLabel("Period 5 start time", { exact: true }).fill("14:10");
  await page.getByRole("button", { name: "Add period", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a period" });
  await dialog.getByLabel("Period category").selectOption("break");
  await expect(dialog.getByLabel("Period name", { exact: true })).toHaveValue(
    "Break",
  );
  await dialog
    .getByLabel("Period name", { exact: true })
    .fill("Afternoon break");
  await dialog.getByLabel("Start time", { exact: true }).fill("14:00");
  await dialog.getByLabel("End time", { exact: true }).fill("14:10");
  await dialog.getByRole("button", { name: "Save period" }).click();
  await expect(page.locator(".period-row")).toHaveCount(9);
  await expect(page.getByLabel("Period 8 label", { exact: true })).toHaveValue(
    "Afternoon break",
  );
  await expect(page.getByLabel("Period 9 label", { exact: true })).toHaveValue(
    "Period 5",
  );
  await page.reload();
  await expect(
    page.getByLabel("Tutor period start time", { exact: true }),
  ).toHaveValue("08:20");
  await expect(
    page.getByLabel("Afternoon break end time", { exact: true }),
  ).toHaveValue("14:10");
  await page.screenshot({
    path: testInfo.outputPath("custom-school-day.png"),
    animations: "disabled",
  });

  await go(page, "My timetable");
  await expect(fixed).toHaveCount(4);
  await expect(
    grid.getByRole("button", { name: /Monday (Tutor period|Afternoon break)/ }),
  ).toHaveCount(0);
  await expect(fixed.filter({ hasText: "Tutor period" })).toContainText(
    "08:20",
  );
  await expect(fixed.filter({ hasText: "Afternoon break" })).toContainText(
    "14:10",
  );
  await page.screenshot({
    path: testInfo.outputPath("fixed-periods.png"),
    animations: "disabled",
  });

  await go(page, "Export & share");
  const include = page.getByRole("checkbox", {
    name: /Include fixed periods/,
  });
  await expect(include).not.toBeChecked();
  const lessons = await downloadEvents(page);
  expect(
    lessons.every(
      (event) =>
        ![
          "Tutor period",
          "Afternoon break",
          "Break",
          "Lunch",
          "Legacy registration subject",
        ].includes(event.summary),
    ),
  ).toBe(true);
  await include.check();
  const all = await downloadEvents(page);
  const tutor = all.find(
    (event) => event.startDate.toString() === "2026-09-07T08:20:00",
  )!;
  expect(tutor.summary).toBe("Tutor period");
  expect(tutor.endDate.toString()).toBe("2026-09-07T08:40:00");
  expect(tutor.location || "").toBe("");
  expect(tutor.description || "").not.toContain("Legacy");
  const afternoon = all.find(
    (event) => event.startDate.toString() === "2026-09-07T14:00:00",
  )!;
  expect(afternoon.summary).toBe("Afternoon break");
  expect(afternoon.endDate.toString()).toBe("2026-09-07T14:10:00");

  await go(page, "Print timetable");
  await expect(page.locator(".print-structural")).toHaveCount(8);
  await expect(
    page.locator(".print-structural").filter({ hasText: "Tutor period" }),
  ).toHaveCount(2);
  await expect(page.locator(".print-sheets")).not.toContainText(
    "Legacy registration subject",
  );
  await go(page, "Lesson times");
  page.once("dialog", (confirmation) => confirmation.accept());
  await page
    .getByRole("button", { name: "Delete Afternoon break", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".period-row")).toHaveCount(8);
  await expect(
    page.getByLabel("Afternoon break category", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Tutor period category", { exact: true }),
  ).toHaveValue("registration");
});

test("period form validates times, supports each fixed category, and fits mobile and desktop in dark mode", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  if (testInfo.project.name.startsWith("mobile"))
    await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await go(page, "Lesson times");
  await page.getByRole("button", { name: "Add period", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("End time", { exact: true })
    .fill("14:00");
  await page.getByRole("button", { name: "Save period", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "End must be later than start",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".period-row")).toHaveCount(8);
  for (const type of ["registration", "break", "lunch"]) {
    await page.getByRole("button", { name: "Add period", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a period" });
    await dialog.getByLabel("Period category").selectOption(type);
    await dialog
      .getByLabel("Period name", { exact: true })
      .fill(`Extra ${type}`);
    await dialog.getByLabel("Start time", { exact: true }).fill("15:00");
    await dialog.getByLabel("End time", { exact: true }).fill("14:00");
    await dialog.getByRole("button", { name: "Save period" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "End must be later than start",
    );
    await expect(page.locator(".period-row")).toHaveCount(8);
    await dialog.getByLabel("End time", { exact: true }).fill("15:15");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(
      await dialog.locator("input, select").evaluateAll((controls) =>
        controls.every((control) => {
          const box = control.getBoundingClientRect();
          const parent = control.parentElement!.getBoundingClientRect();
          return (
            box.left >= parent.left - 1 &&
            box.right <= parent.right + 1 &&
            box.height >= 44
          );
        }),
      ),
    ).toBe(true);
    if (type === "registration") {
      await page.screenshot({
        path: testInfo.outputPath("add-registration-dark.png"),
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
    }
    await dialog.getByRole("button", { name: "Save period" }).click();
    await expect(page.locator(".period-row")).toHaveCount(9);
    await expect(
      page.getByLabel(`Extra ${type} category`, { exact: true }),
    ).toHaveValue(type);
    await page
      .getByLabel(`Extra ${type} end time`, { exact: true })
      .fill("15:20");
    await go(page, "My timetable");
    const grid = page.locator(
      ".desktop-timetable:visible, .mobile-timetable:visible",
    );
    await expect(
      grid
        .locator(".structural-row, .mobile-period.structural")
        .filter({ hasText: `Extra ${type}` }),
    ).toContainText("15:20");
    await expect(
      grid.getByRole("button", { name: new RegExp(`Monday Extra ${type}`) }),
    ).toHaveCount(0);
    await go(page, "Lesson times");
    page.once("dialog", (confirmation) => confirmation.accept());
    await page
      .getByRole("button", { name: `Delete Extra ${type}`, exact: true })
      .click();
    await expect(page.locator(".period-row")).toHaveCount(8);
  }
});
