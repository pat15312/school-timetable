import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";
import { sampleProject } from "../src/domain/fixture";
import { serializeProject } from "../src/domain/persistence";

async function go(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible())
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function continueSetup(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function holiday(
  page: Page,
  name: string,
  start: string,
  end: string,
  reset: boolean,
) {
  await page.getByRole("button", { name: "Add days off", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByLabel("Start date", { exact: true }).fill(start);
  await page.getByLabel("End date", { exact: true }).fill(end);
  if (reset) await page.getByRole("radio", { name: /Yes, reset/ }).check();
  await page.getByRole("button", { name: "Save days off" }).click();
}
function activeGrid(page: Page) {
  return page.locator(".desktop-timetable:visible, .mobile-timetable:visible");
}
async function expectPrintRowsToFit(page: Page) {
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  const overflows = await page
    .locator(".print-table-wrap")
    .evaluateAll((wrappers) =>
      wrappers.map((wrapper) => {
        const lastRow = wrapper.querySelector("tbody tr:last-child")!;
        return (
          lastRow.getBoundingClientRect().bottom -
          wrapper.getBoundingClientRect().bottom
        );
      }),
    );
  expect(overflows.every((amount) => amount <= 1)).toBe(true);
  await page.emulateMedia({ media: null });
}
async function sample(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sample timetable", exact: true }),
  ).toBeVisible();
}

test("complete setup, holiday-aware review, both print layouts, and ICS download", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByLabel("Timetable name")).toHaveValue("");
  await page.getByLabel("Timetable name").fill("School week");
  await page.getByLabel("First day of school").fill("2026-09-07");
  await page.getByLabel("Last day of school").fill("2027-07-16");
  await page.getByLabel("School time zone").fill("Europe/London");
  await continueSetup(page);
  await page.getByRole("button", { name: "2 week cycle", exact: true }).click();
  await page
    .getByRole("button", { name: "Numbers Week 1 · Week 2", exact: true })
    .click();
  await page
    .getByLabel("Which timetable week is the first week of school?")
    .selectOption("0");
  await continueSetup(page);
  await holiday(page, "October half-term", "2026-10-26", "2026-10-30", false);
  await holiday(page, "Christmas holiday", "2026-12-21", "2027-01-01", true);
  await expect(
    page.getByText("Reset to Week 1", { exact: true }),
  ).toBeVisible();
  await continueSetup(page);
  await page.getByRole("button", { name: "Use a standard school day" }).click();
  await expect(page.getByLabel("Break category", { exact: true })).toHaveValue(
    "break",
  );
  await expect(page.getByLabel("Lunch category", { exact: true })).toHaveValue(
    "lunch",
  );
  await continueSetup(page);
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject name", { exact: true }).fill("Mathematics");
  await page.getByLabel("Default teacher (optional)").fill("Mrs Jones");
  await page.getByLabel("Default room (optional)").fill("M12");
  await page.getByRole("button", { name: "Save subject" }).click();
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject name", { exact: true }).fill("English");
  await page.getByRole("button", { name: "Save subject" }).click();
  await continueSetup(page);
  await page.getByRole("button", { name: "Mathematics", exact: true }).click();
  await activeGrid(page)
    .getByRole("button", { name: "Monday Period 1, empty", exact: true })
    .click();
  await page.getByRole("tab", { name: "Week 2", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await activeGrid(page)
    .getByRole("button", { name: "Monday Period 1, empty", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Finish & view overview",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Ready to export", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview lessons", exact: true })
    .click();
  await page.getByLabel("Jump to a date").fill("2026-11-02");
  await expect(page.locator(".preview-week-label")).toContainText("Week 2");
  await expect(page.locator('[data-date="2026-11-02"]')).toContainText(
    "English",
  );
  await page.getByLabel("Jump to a date").fill("2027-01-04");
  await expect(page.locator(".preview-week-label")).toContainText("Week 1");
  await expect(page.locator('[data-date="2027-01-04"]')).toContainText(
    "Mathematics",
  );
  await go(page, "Export & share");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .ics", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("school-week-timetable.ics");
  const calendarText = await readFile((await download.path())!, "utf8");
  const calendar = new ICAL.Component(ICAL.parse(calendarText));
  const events = calendar
    .getAllSubcomponents("vevent")
    .map((component) => new ICAL.Event(component));
  expect(events.length).toBeGreaterThan(30);
  expect(calendarText).not.toContain("RRULE");
  expect(
    events.every(
      (e) => !["Registration", "Break", "Lunch"].includes(e.summary),
    ),
  ).toBe(true);
  expect(
    events.find((e) => e.startDate.toString().startsWith("2026-11-02"))
      ?.summary,
  ).toBe("English");
  expect(
    events.find((e) => e.startDate.toString().startsWith("2027-01-04"))
      ?.summary,
  ).toBe("Mathematics");
  expect(
    events.some((e) => e.startDate.toString().startsWith("2026-10-26")),
  ).toBe(false);
  expect(
    events.some((e) => e.startDate.toString().startsWith("2026-12-21")),
  ).toBe(false);
  await go(page, "Print timetable");
  await expect(page.locator(".print-sheet")).toHaveCount(2);
  await expect(page.locator(".print-sheets").getByRole("button")).toHaveCount(
    0,
  );
  await expect(
    page.locator(".print-sheets").getByText("Break", { exact: true }),
  ).toHaveCount(4);
  await expect(
    page.locator(".print-sheets").getByText("Lunch", { exact: true }),
  ).toHaveCount(4);
  if (testInfo.project.name === "desktop-chromium") {
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    await testInfo.attach("landscape-timetable.pdf", {
      body: pdf,
      contentType: "application/pdf",
    });
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
  }
  await page
    .getByRole("radio", { name: "Two weeks per page A4 portrait" })
    .check();
  await expect(page.locator(".print-sheet")).toHaveCount(1);
  if (testInfo.project.name === "desktop-chromium") {
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    await testInfo.attach("portrait-timetable.pdf", {
      body: pdf,
      contentType: "application/pdf",
    });
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  }
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "School week", exact: true }),
  ).toBeVisible();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 1, Mathematics",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("painting, overrides, copy across weeks, erase, undo, duplication, and backup", async ({
  page,
}, testInfo) => {
  await sample(page);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await activeGrid(page)
    .getByRole("button", { name: "Monday Period 1, Mathematics", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit lesson", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Override room / location" })
    .check();
  await page.getByLabel("Room / location", { exact: true }).fill("Lab 3");
  await page.getByLabel("Notes (optional)").fill("Bring a calculator");
  await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 1, Mathematics",
      exact: true,
    }),
  ).toContainText("Lab 3");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.getByRole("tab", { name: "Week 2", exact: true }).click();
  await activeGrid(page)
    .getByRole("button", { name: /^Monday Period 2,/ })
    .click();
  await page.getByRole("button", { name: "Paste", exact: true }).click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 2, Mathematics",
      exact: true,
    }),
  ).toContainText("Lab 3");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 2, empty",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo last edit" }).click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 2, Mathematics",
      exact: true,
    }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop-chromium") {
    await activeGrid(page)
      .getByRole("button", {
        name: "Monday Period 2, Mathematics",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Delete");
    await expect(
      activeGrid(page).getByRole("button", {
        name: "Monday Period 2, empty",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(
      activeGrid(page).getByRole("button", {
        name: "Monday Period 2, Mathematics",
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Copy week", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "existing lessons in Week 1 will be replaced",
  );
  await page
    .getByRole("button", { name: "Copy Week 2 to Week 1", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Week 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 2, Mathematics",
      exact: true,
    }),
  ).toContainText("Lab 3");
  await page.getByRole("button", { name: "Undo last edit" }).click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Monday Period 2, Biology",
      exact: true,
    }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await go(page, "Export & share");
  await page
    .getByRole("button", { name: "Download backup (.json)", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(backup.schemaVersion).toBe(2);
  expect(
    backup.timetable.entries.some(
      (e: { notes?: string }) => e.notes === "Bring a calculator",
    ),
  ).toBe(true);
});

test("mobile day navigation, adding subjects in the editor, and no horizontal overflow", async ({
  page,
}) => {
  await sample(page);
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject name", { exact: true }).fill("Art");
  await page.getByRole("button", { name: "Save subject" }).click();
  if (await page.locator(".mobile-timetable").isVisible())
    await page.getByRole("tab", { name: "Tue", exact: true }).click();
  await activeGrid(page)
    .getByRole("button", { name: /^Tuesday Period 1,/ })
    .click();
  await expect(
    activeGrid(page).getByRole("button", {
      name: "Tuesday Period 1, Art",
      exact: true,
    }),
  ).toBeVisible();
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(fits).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("timetable.png"),
    fullPage: true,
  });
});

test("invalid imports and corrupted storage do not overwrite recoverable data", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("schoolcal.project.v1", "{broken"),
  );
  await page.goto("./");
  await expect(
    page.getByText(/Your saved timetable could not be opened/),
  ).toBeVisible();
  await page.getByLabel("Timetable name").fill("Unsaved");
  expect(
    await page.evaluate(() => localStorage.getItem("schoolcal.project.v1")),
  ).toBe("{broken");
  await page.getByLabel("Import project file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "not a supported SchoolCal project" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("schoolcal.project.v1")),
  ).toBe("{broken");
});

test("production app and saved timetable open offline from the configured base path", async ({
  page,
  context,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4173") &&
      !request.url().startsWith("data:")
    )
      externalRequests.push(request.url());
  });
  await sample(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sample timetable", exact: true }),
  ).toBeVisible();
  await go(page, "Export & share");
  await expect(
    page.getByRole("button", { name: "Download .ics", exact: true }),
  ).toBeEnabled();
  expect(externalRequests).toEqual([]);
});

test("restores a backup and keeps a four-week printout within its chosen pages", async ({
  page,
}, testInfo) => {
  const project = sampleProject();
  project.cycleLength = 4;
  project.rotationLabelStyle = "letters";
  const original = project.periods.find((p) => p.categoryId === "lesson")!;
  project.periods = Array.from({ length: 24 }, (_, i) => ({
    ...original,
    id: `period-${i}`,
    name: `Period ${i + 1}`,
    sortOrder: i,
  }));
  project.entries = Array.from({ length: 4 }, (_, rotationIndex) =>
    project.periods.flatMap((period) =>
      [1, 2, 3, 4, 5].map((weekday) => ({
        id: `entry-${rotationIndex}-${period.id}-${weekday}`,
        rotationIndex,
        weekday,
        periodId: period.id,
        subjectId: project.subjects[0].id,
      })),
    ),
  ).flat();
  await page.goto("./");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Import project file").setInputFiles({
    name: "timetable.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeProject(project)),
  });
  await expect(
    page.getByRole("heading", { name: project.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Week D", exact: true }),
  ).toBeVisible();
  await go(page, "Print timetable");
  await expect(page.locator(".print-sheet")).toHaveCount(4);
  if (testInfo.project.name === "desktop-chromium") {
    await expectPrintRowsToFit(page);
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(4);
  }
  await page
    .getByRole("radio", { name: "Two weeks per page A4 portrait" })
    .check();
  await expect(page.locator(".print-sheet")).toHaveCount(2);
  if (testInfo.project.name === "desktop-chromium") {
    await expectPrintRowsToFit(page);
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
  }
});
