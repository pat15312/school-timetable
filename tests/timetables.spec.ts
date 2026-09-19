import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { sampleProject } from "../src/domain/fixture";
import { serializeProject, STORAGE_KEY } from "../src/domain/persistence";
import { encodeTransfer } from "../src/domain/transfer";
import { TIMETABLES_KEY } from "../src/domain/timetables";
import { savedLibrary, savedProject } from "./storage";

async function manage(page: Page) {
  await page.getByRole("button", { name: /^Switch timetable:/ }).click();
  return page.getByRole("dialog", { name: "Your timetables" });
}
async function select(page: Page, name: string) {
  const dialog = await manage(page);
  await dialog
    .getByRole("button", { name: new RegExp(`^${name} (Active|Ready|Setup)`) })
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
async function sample(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sample timetable", exact: true }),
  ).toBeVisible();
}
async function fileText(page: Page, button: string) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  return readFile((await (await downloading).path())!, "utf8");
}

test("create, switch, resume setup, rename and duplicate without changing the original", async ({
  page,
}) => {
  await sample(page);
  const original = await savedProject(page);
  await (
    await manage(page)
  )
    .getByRole("button", { name: "New timetable", exact: true })
    .click();
  await page.getByLabel("Timetable name").fill("Another school");
  await page.getByLabel("First day of school").fill("2026-09-07");
  await page.getByLabel("Last day of school").fill("2027-07-16");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "3 week cycle", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const draft = await savedProject(page);
  expect(draft.setupStep).toBe(2);
  await select(page, "Sample timetable");
  expect(await savedProject(page)).toEqual(original);
  await select(page, "Another school");
  await expect(page).toHaveURL(/#holidays$/);
  expect(await savedProject(page)).toEqual(draft);
  await page.reload();
  expect(await savedProject(page)).toEqual(draft);
  const dialog = await manage(page);
  await dialog
    .getByRole("button", { name: "Rename Another school", exact: true })
    .click();
  await dialog.getByLabel("Timetable name").fill("My draft");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await dialog
    .getByRole("button", { name: "Duplicate My draft", exact: true })
    .click();
  const copy = await savedProject(page);
  expect(copy.id).not.toBe(draft.id);
  expect(copy.name).toBe("My draft (copy)");
  expect(copy.setupStep).toBe(2);
  await go(page, "School year");
  await page.getByLabel("Timetable name").fill("Independent copy");
  await select(page, "My draft");
  expect((await savedProject(page)).name).toBe("My draft");
  expect((await savedLibrary(page)).timetables[0]).toEqual(original);
});

test("confirms deletion, keeps inactive work, and opens a blank setup after deleting the last timetable", async ({
  page,
}) => {
  await sample(page);
  await (
    await manage(page)
  )
    .getByRole("button", { name: "Duplicate Sample timetable", exact: true })
    .click();
  const copy = await savedProject(page);
  let dialog = await manage(page);
  page.once("dialog", (d) => d.dismiss());
  await dialog
    .getByRole("button", { name: "Delete Sample timetable", exact: true })
    .click();
  expect((await savedLibrary(page)).timetables).toHaveLength(2);
  page.once("dialog", (d) => d.accept());
  await dialog
    .getByRole("button", { name: "Delete Sample timetable", exact: true })
    .click();
  expect(await savedProject(page)).toEqual(copy);
  expect((await savedLibrary(page)).timetables).toHaveLength(1);
  page.once("dialog", (d) => d.accept());
  await dialog
    .getByRole("button", {
      name: "Delete Sample timetable (copy)",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Timetable name")).toHaveValue("");
  await expect(page).toHaveURL(/#year$/);
  await page.reload();
  expect((await savedLibrary(page)).timetables).toHaveLength(1);
  expect((await savedProject(page)).id).not.toBe(copy.id);
});

test("imports and incoming transfers add independent copies and cancellation keeps the collection intact", async ({
  page,
}) => {
  await sample(page);
  const original = await savedProject(page);
  const incoming = {
    ...original,
    name: "Received timetable",
    setupComplete: false,
    setupStep: 4,
  };
  const upload = () =>
    page.getByLabel("Import project file").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(serializeProject(incoming)),
    });
  page.once("dialog", (d) => d.dismiss());
  await upload();
  expect((await savedLibrary(page)).timetables).toEqual([original]);
  page.once("dialog", (d) => d.accept());
  await upload();
  await expect(page).toHaveURL(/#subjects$/);
  const imported = await savedProject(page);
  expect(imported.id).not.toBe(original.id);
  expect((await savedLibrary(page)).timetables[0]).toEqual(original);
  await page.evaluate(
    (hash) => {
      location.hash = hash;
    },
    await encodeTransfer(incoming),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your saved timetables will be kept");
  await dialog.getByRole("button", { name: "Use this timetable" }).click();
  await expect(dialog).toHaveCount(0);
  const received = await savedProject(page);
  expect(received.id).not.toBe(imported.id);
  expect(received.id).not.toBe(original.id);
  expect((await savedLibrary(page)).timetables).toHaveLength(3);
  await page.reload();
  expect((await savedLibrary(page)).timetables).toHaveLength(3);
});

test("switching resets editor history and uses the active timetable for preview, backup, calendar, transfer and print", async ({
  page,
}) => {
  await sample(page);
  const original = await savedProject(page);
  await (
    await manage(page)
  )
    .getByRole("button", { name: "Duplicate Sample timetable", exact: true })
    .click();
  const dialog = await manage(page);
  await dialog
    .getByRole("button", {
      name: "Rename Sample timetable (copy)",
      exact: true,
    })
    .click();
  await dialog.getByLabel("Timetable name").fill("Second timetable");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  const grid = page.locator(
    ".desktop-timetable:visible, .mobile-timetable:visible",
  );
  await grid
    .getByRole("button", { name: "Monday Period 1, Mathematics", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo last edit" }),
  ).toBeEnabled();
  await select(page, "Sample timetable");
  await expect(
    page.getByRole("button", { name: "Undo last edit" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Paste", exact: true }),
  ).toBeDisabled();
  expect(await savedProject(page)).toEqual(original);
  await select(page, "Second timetable");
  await expect(
    grid.getByRole("button", { name: "Monday Period 1, empty", exact: true }),
  ).toBeVisible();
  await go(page, "Export & share");
  const second = await savedProject(page);
  expect(
    JSON.parse(await fileText(page, "Download backup (.json)")).timetable,
  ).toEqual(second);
  const calendar = await fileText(page, "Download calendar");
  expect(calendar).toContain("X-WR-CALNAME:Second timetable");
  expect(calendar).toContain(second.id);
  expect(calendar).not.toContain(original.id);
  await page.getByLabel(/Include.*(fixed|break|registration)/i).check();
  await page.getByRole("button", { name: "Show QR code" }).click();
  await expect(page.getByRole("img", { name: /Scan to open/ })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await select(page, "Sample timetable");
  await go(page, "Export & share");
  await expect(
    page.getByLabel(/Include.*(fixed|break|registration)/i),
  ).not.toBeChecked();
  expect(
    JSON.parse(await fileText(page, "Download backup (.json)")).timetable,
  ).toEqual(original);
  await select(page, "Second timetable");
  await go(page, "Lesson preview");
  await expect(
    page.getByLabel(/Include.*(fixed|break|registration)/i),
  ).toBeChecked();
  await go(page, "Print timetable");
  await expect(page.locator(".print-sheet").first()).toContainText(
    "Second timetable",
  );
  await select(page, "Sample timetable");
  await go(page, "Print timetable");
  await expect(page.locator(".print-sheet").first()).toContainText(
    "Sample timetable",
  );
  await expect(page.locator(".print-sheet").first()).not.toContainText(
    "Second timetable",
  );
});

test("failed saves block switching and preserve both saved work and unsaved edits", async ({
  page,
}) => {
  await sample(page);
  const original = await savedProject(page);
  await (
    await manage(page)
  )
    .getByRole("button", { name: "New timetable", exact: true })
    .click();
  await page.getByLabel("Timetable name").fill("Saved draft");
  const before = await savedLibrary(page);
  await page.evaluate((key) => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Full", "QuotaExceededError");
      originalSet.call(this, name, value);
    };
  }, TIMETABLES_KEY);
  await page.getByLabel("Timetable name").fill("Unsaved edits");
  const dialog = await manage(page);
  await dialog.getByRole("button", { name: /^Sample timetable Ready/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not save");
  expect(await savedLibrary(page)).toEqual(before);
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Timetable name")).toHaveValue("Unsaved edits");
  expect((await savedLibrary(page)).timetables[0]).toEqual(original);
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: timetable controls are accessible, fit small screens and work offline`, async ({
    page,
    context,
    browserName,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    if (info.project.name.startsWith("mobile"))
      await page.setViewportSize({ width: 320, height: 800 });
    await sample(page);
    await (
      await manage(page)
    )
      .getByRole("button", { name: "Duplicate Sample timetable", exact: true })
      .click();
    const copy = await savedProject(page);
    await manage(page);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`timetables-${theme}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    // Playwright WebKit cannot reliably reload a service-worker page in offline mode.
    // Chromium covers the offline path; both engines cover saved selection on reload.
    if (browserName === "chromium") await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: copy.name, exact: true }),
    ).toBeVisible();
    expect(await savedProject(page)).toEqual(copy);
    await select(page, "Sample timetable");
    await page.reload();
    expect((await savedProject(page)).name).toBe("Sample timetable");
  });
}

test("legacy data migrates once, keeps its original bytes, and does not return after deleting the timetable", async ({
  page,
}) => {
  const original = sampleProject();
  const raw = serializeProject(original);
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: STORAGE_KEY, raw },
  );
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: original.name, exact: true }),
  ).toBeVisible();
  expect(await savedProject(page)).toEqual(original);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
  const dialog = await manage(page);
  page.once("dialog", (d) => d.accept());
  await dialog
    .getByRole("button", { name: "Delete Sample timetable", exact: true })
    .click();
  await page.reload();
  expect((await savedProject(page)).id).not.toBe(original.id);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
});

test("another tab cannot overwrite saved work with stale edits", async ({
  page,
  context,
}) => {
  await sample(page);
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(
    other.getByRole("heading", { name: "Sample timetable", exact: true }),
  ).toBeVisible();
  await go(page, "School year");
  await page.getByLabel("Timetable name").fill("Saved in the first tab");
  const before = await savedLibrary(page);
  await go(other, "School year");
  await other.getByLabel("Timetable name").fill("Unsaved in the second tab");
  await expect(other.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  expect(await savedLibrary(other)).toEqual(before);
  expect((await savedProject(page)).name).toBe("Saved in the first tab");
  await expect(other.getByLabel("Timetable name")).toHaveValue(
    "Unsaved in the second tab",
  );
});

test("damaged collection stays recoverable through edits, invalid imports and an explicit fresh start", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, "{damaged collection");
  }, TIMETABLES_KEY);
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText(
    "saved timetable could not be opened",
  );
  await page
    .getByLabel("Timetable name")
    .fill("Not saved over the damaged data");
  await page
    .getByLabel("Import project file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "not a supported SchoolCal" }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), TIMETABLES_KEY),
  ).toBe("{damaged collection");
  const downloaded = await fileText(page, "Download saved data");
  expect(downloaded).toBe("{damaged collection");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByLabel("Timetable name")).toHaveValue("");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("schoolcal.timetables.recovery"),
    ),
  ).toBe("{damaged collection");
  await page.reload();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await savedProject(page)).setupStep).toBe(0);
});
