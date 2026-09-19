import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  createSpreadsheet,
  readSpreadsheet,
  writeSpreadsheet,
} from "../src/domain/spreadsheet";
import { testProject } from "../src/domain/test-helpers";
import { serializeProject, STORAGE_KEY } from "../src/domain/persistence";
import { SPREADSHEET_MIME } from "../src/domain/spreadsheetTypes";
import { savedLibrary, savedProject } from "./storage";

async function start(page: Page) {
  await page.addInitScript(
    ({ key, value }) => {
      if (
        !localStorage.getItem(key) &&
        !localStorage.getItem("schoolcal.timetables.v1")
      )
        localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: serializeProject(testProject()) },
  );
  await page.goto("./#export");
  await expect(
    page.getByRole("heading", { name: "Edit in a spreadsheet" }),
  ).toBeVisible();
  // The screen can paint before the initial legacy-data migration is persisted.
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("schoolcal.timetables.v1")),
    )
    .not.toBeNull();
}
async function upload(page: Page, buffer: Uint8Array) {
  await page.getByLabel("Import spreadsheet file").setInputFiles({
    name: "timetable.xlsx",
    mimeType: SPREADSHEET_MIME,
    buffer: Buffer.from(buffer),
  });
  return page.getByRole("dialog", { name: "Preview spreadsheet import" });
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await pending).path())!);
}

test("exports the active timetable, previews without saving, then imports as an independent timetable", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await start(page);
  const original = await savedProject(page);
  const exported = await download(page, "Export spreadsheet (.xlsx)");
  expect(
    (await readSpreadsheet(Uint8Array.from(exported).buffer)).project.name,
  ).toBe(original.name);
  const incoming = testProject();
  incoming.name = "From my spreadsheet";
  Object.assign(incoming.entries[1], {
    teacherOverride: "",
    roomOverride: "R12",
    notes: "Bring a ruler",
  });
  const bytes = await writeSpreadsheet(incoming);
  let dialog = await upload(page, bytes);
  await expect(
    dialog.getByRole("button", { name: "Add timetable", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Bring a ruler", { exact: true }),
  ).toBeVisible();
  expect((await savedLibrary(page)).timetables).toEqual([original]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await savedProject(page)).toEqual(original);
  dialog = await upload(page, bytes);
  await dialog
    .getByRole("button", { name: "Add timetable", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const imported = await savedProject(page);
  expect(imported.name).toBe(incoming.name);
  expect(imported.id).not.toBe(original.id);
  expect((await savedLibrary(page)).timetables[0]).toEqual(original);
  await page.reload();
  expect(await savedProject(page)).toEqual(imported);
  await page.goto("./#export");
  const next = await download(page, "Export spreadsheet (.xlsx)");
  expect(
    (await readSpreadsheet(Uint8Array.from(next).buffer)).project.name,
  ).toBe(incoming.name);
});

test("template survives reload and works offline in Chromium", async ({
  page,
  context,
  browserName,
}) => {
  await start(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  // Playwright WebKit cannot reliably reload service-worker pages offline.
  if (browserName === "chromium") await context.setOffline(true);
  await page.reload();
  const bytes = await download(page, "Download template (.xlsx)");
  const preview = await readSpreadsheet(Uint8Array.from(bytes).buffer);
  expect(preview.project.entries).toHaveLength(0);
  expect(preview.project.subjects).toHaveLength(3);
  const dialog = await upload(page, bytes);
  await expect(
    dialog.getByText("This timetable will be saved as a draft.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add timetable", exact: true })
    .click();
  await expect(page).toHaveURL(/#year$/);
  expect((await savedProject(page)).setupComplete).toBe(false);
  expect((await savedLibrary(page)).timetables).toHaveLength(2);
});

for (const scheme of ["light", "dark"] as const)
  test(`${scheme}: accessible preview and cell errors leave saved work unchanged`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: scheme });
    await start(page);
    const original = await savedProject(page);
    let dialog = await upload(page, await writeSpreadsheet(testProject()));
    await expect(
      dialog.getByRole("button", { name: "Add timetable", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    const bad = createSpreadsheet(testProject());
    bad.getWorksheet("Week 1")!.getCell("B2").value = "UNKNOWN_SUBJECT";
    dialog = await upload(page, new Uint8Array(await bad.xlsx.writeBuffer()));
    await expect(
      dialog.getByRole("listitem").filter({ hasText: "Week 1!B2:" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Add timetable", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await savedProject(page)).toEqual(original);
  });

test("a failed storage write keeps the import preview and the original timetable", async ({
  page,
}) => {
  await start(page);
  const original = await savedProject(page);
  const incoming = testProject();
  incoming.name = "Cannot save yet";
  const dialog = await upload(page, await writeSpreadsheet(incoming));
  await expect(
    dialog.getByRole("button", { name: "Add timetable", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await dialog
    .getByRole("button", { name: "Add timetable", exact: true })
    .click();
  await expect(dialog.getByText(/Your browser could not save/)).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await savedProject(page)).toEqual(original);
});
