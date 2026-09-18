import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import jsQR from "jsqr";
import ICAL from "ical.js";
import fixture from "./fixtures/qr-transfer-project.json" with { type: "json" };
import {
  parseProject,
  serializeProject,
  STORAGE_KEY,
} from "../src/domain/persistence";
import { createProject, type TimetableProject } from "../src/domain/model";
import { decodeTransfer } from "../src/domain/transfer";

test.describe.configure({ timeout: 60_000 });
const project = parseProject(JSON.stringify(fixture));

async function seed(page: Page, p = project) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    { key: STORAGE_KEY, data: serializeProject(p) },
  );
}
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function saved(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).timetable,
    STORAGE_KEY,
  );
}
async function backup(page: Page) {
  const downloading = page.waitForEvent("download");
  await page
    .locator(".backup-card")
    .getByRole("button", { name: "Download backup (.json)" })
    .click();
  return JSON.parse(await readFile((await (await downloading).path())!, "utf8"))
    .timetable;
}
async function scan(page: Page) {
  await page.getByRole("button", { name: "Show QR code" }).click();
  const image = page.getByRole("img", { name: /Scan to open/ });
  await expect(image).toBeVisible();
  // Decode actual rendered image pixels with an independent QR reader.
  const pixels = await image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth / 2;
    canvas.height = element.naturalHeight / 2;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    return {
      data: Array.from(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      ),
      width: canvas.width,
      height: canvas.height,
    };
  });
  const code = jsQR(
    new Uint8ClampedArray(pixels.data),
    pixels.width,
    pixels.height,
  );
  expect(code, "QR image is readable").not.toBeNull();
  return code!.data;
}

test("generated QR transfers every fixture field to a separate device and reflects later edits", async ({
  page,
  browser,
}, testInfo) => {
  await seed(page);
  await page.goto("./?discard=this#export");
  const url = await scan(page);
  expect(new URL(url).pathname).toBe(new URL(page.url()).pathname);
  expect(new URL(url).search).toBe("");
  expect(await decodeTransfer(new URL(url).hash)).toEqual(project);
  await page.screenshot({
    path: testInfo.outputPath("generated-qr.png"),
    fullPage: true,
  });
  const receiver = await browser.newContext();
  try {
    const other = await receiver.newPage();
    await other.goto(url);
    await other.getByRole("button", { name: "Use this timetable" }).click();
    await expect(other).toHaveURL(/#timetable$/);
    await expect.poll(() => saved(other)).toEqual(project);
    await other.reload();
    await go(other, "Export & share");
    expect(await backup(other)).toEqual(project);
  } finally {
    await receiver.close();
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  await go(page, "School year");
  await page.getByLabel("Timetable name").fill("Updated timetable");
  const edited = await saved(page);
  await go(page, "Export & share");
  const updated = await scan(page);
  expect(updated).not.toBe(url);
  expect(await decodeTransfer(new URL(updated).hash)).toEqual(edited);
});

test("legacy overview links open the dated preview and export shares the fixed-period choice", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-18T16:00:00Z"));
  await seed(page);
  await page.goto("./#review"); // Existing bookmarks remain useful.
  await expect(page.locator(".year-progress")).toBeVisible();
  await expect(page.locator(".calendar-preview")).toBeVisible();
  await expect(page.locator(".export-card")).toHaveCount(0);
  await page.goto("./#overview");
  await expect(page.locator(".year-progress")).toBeVisible();
  const totals = await page.locator(".year-progress").innerText();
  await expect(
    page.locator(".preview-event").filter({ hasText: "Tutor time" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: /Include fixed periods/ }).check();
  await expect(
    page.locator(".preview-event").filter({ hasText: "Tutor time" }).first(),
  ).toBeVisible();
  await expect(page.locator(".year-progress")).toHaveText(totals, {
    useInnerText: true,
  });
  await go(page, "Export & share");
  await expect(page.locator(".year-progress, .calendar-preview")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("checkbox", { name: /Include fixed periods/ }),
  ).toBeChecked();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download calendar", exact: true })
    .click();
  const content = await readFile((await (await downloading).path())!, "utf8");
  const events = new ICAL.Component(ICAL.parse(content)).getAllSubcomponents(
    "vevent",
  );
  expect(
    events.some((e) => e.getFirstPropertyValue("summary") === "Tutor time"),
  ).toBe(true);
  await page.getByRole("checkbox", { name: /Include fixed periods/ }).uncheck();
  await go(page, "Lesson preview");
  await expect(
    page.getByRole("checkbox", { name: /Include fixed periods/ }),
  ).not.toBeChecked();
  await expect(
    page.locator(".preview-event").filter({ hasText: "Tutor time" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".calendar-preview")).toBeVisible();
});

test("year progress refreshes as lessons end and stays independent of the previewed week", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-07T08:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-07T08:44:45Z"));
  await seed(page);
  await page.goto("./#preview");
  const lessons = page.getByRole("progressbar", {
    name: "Lessons completed",
    exact: true,
  });
  const weeks = page.getByRole("progressbar", {
    name: "Teaching weeks completed",
    exact: true,
  });
  await expect(lessons).toHaveAttribute("max", "970");
  await expect(lessons).toHaveAttribute("value", "0");
  await expect(weeks).toHaveAttribute("value", "0");
  await page.clock.fastForward(30_000);
  await expect(lessons).toHaveAttribute("value", "1");
  await page.getByRole("button", { name: "Next teaching week" }).click();
  await expect(lessons).toHaveAttribute("value", "1");
  await page.clock.setFixedTime(new Date("2027-07-16T14:00:00Z"));
  await page.clock.fastForward(30_000);
  await expect(lessons).toHaveAttribute("value", "970");
  await expect(page.locator(".year-progress-total b")).toHaveText([
    "100% done!",
    "100% done!",
  ]);
});

test("unfinished setup can back up, restore and transfer without becoming complete", async ({
  page,
}) => {
  const draft = createProject();
  draft.name = "Work in progress";
  draft.setupStep = 2;
  await seed(page, draft);
  await page.goto("./");
  await go(page, "Export & share");
  await expect(
    page.getByRole("button", { name: "Download calendar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("alert").filter({
      hasText: "A few things to finish before calendar export",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check school year" }).first(),
  ).toBeVisible();
  expect(await backup(page)).toEqual(draft);
  const received = await decodeTransfer(new URL(await scan(page)).hash);
  expect(received).toEqual(draft);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const imported = { ...project, setupComplete: false, setupStep: 4 };
  page.once("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import backup (.json)" }).click();
  await (
    await chooser
  ).setFiles({
    name: "draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeProject(imported)),
  });
  await expect(page).toHaveURL(/#subjects$/);
  expect(await saved(page)).toEqual(imported);
});

test("oversized QR offers an intact transfer link with manual copying when the clipboard is blocked", async ({
  page,
}) => {
  const large: TimetableProject = structuredClone(project);
  large.entries[0].notes = Array.from({ length: 70 }, (_, i) =>
    createHash("sha256").update(String(i)).digest("hex"),
  )
    .join("")
    .slice(0, 3900);
  await seed(page, large);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Blocked");
        },
      },
    }),
  );
  await page.goto("./#export");
  await expect(page.getByText(/too large for a single QR code/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show QR code" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Copy transfer link", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Automatic copying is unavailable",
  );
  const link = await page
    .getByRole("textbox", { name: "Transfer link", exact: true })
    .inputValue();
  expect(await decodeTransfer(new URL(link).hash)).toEqual(large);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await backup(page)).toEqual(large);
});

test("copying sends the current transfer link to the clipboard", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) =>
          sessionStorage.setItem("copiedLink", value),
      },
    }),
  );
  await page.goto("./#export");
  await page
    .getByRole("button", { name: "Copy transfer link", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Transfer link copied");
  const link = await page.evaluate(() => sessionStorage.getItem("copiedLink")!);
  expect(await decodeTransfer(new URL(link).hash)).toEqual(project);
});

test("a browser without compression can still export and back up", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() =>
    Object.defineProperty(window, "CompressionStream", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.goto("./#export");
  await expect(
    page.getByText(/This browser cannot create transfer links/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show QR code" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Download calendar", exact: true }),
  ).toBeEnabled();
  expect(await backup(page)).toEqual(project);
});

test("calendar export explains an empty school year and keeps backups available", async ({
  page,
}) => {
  const emptyYear = structuredClone(project);
  emptyYear.academicYear.exclusions = [
    {
      id: "whole-year",
      name: "All days off",
      startDate: emptyYear.academicYear.startDate,
      endDate: emptyYear.academicYear.endDate,
      resetRotationAfter: false,
    },
  ];
  await seed(page, emptyYear);
  await page.goto("./#export");
  await expect(
    page.getByRole("button", { name: "Download calendar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/No lessons fall on actual school days/),
  ).toBeVisible();
  expect(await backup(page)).toEqual(emptyYear);
  await page.getByRole("button", { name: "Check school dates" }).click();
  await expect(page).toHaveURL(/#year$/);
});

test("calendar warnings link to the relevant settings without blocking export", async ({
  page,
}) => {
  const overlapping = structuredClone(project);
  overlapping.periods[0].endTime = "09:00";
  await seed(page, overlapping);
  await page.goto("./#export");
  await expect(page.getByText(/Some periods overlap/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download calendar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check lesson times" }).click();
  await expect(page).toHaveURL(/#periods$/);
});

test("QR generation works offline after the app is cached", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright service-worker controls are supported in Chromium.",
  );
  await seed(page);
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await go(page, "Export & share");
  expect(await decodeTransfer(new URL(await scan(page)).hash)).toEqual(project);
});
