import { savedProject } from "./storage";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import fixture from "./fixtures/qr-transfer-project.json" with { type: "json" };
import {
  parseProject,
  serializeProject,
  STORAGE_KEY,
} from "../src/domain/persistence";
import { encodeTransfer } from "../src/domain/transfer";

const project = parseProject(JSON.stringify(fixture));

async function backup(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  const downloading = page.waitForEvent("download");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Export & share", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Download backup (.json)", exact: true })
    .click();
  return JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
}

test("scanned timetable opens, saves, reloads, and exports every fixture field", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`./${await encodeTransfer(project)}`);
  const dialog = page.getByRole("dialog", {
    name: "Continue with this timetable?",
  });
  await expect(
    dialog.getByRole("heading", { name: project.name, exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText(
    "4-week cycle · 10 subjects · 100 lesson slots",
  );
  await dialog.getByRole("button", { name: "Use this timetable" }).click();
  await expect(
    page.getByRole("heading", { name: project.name, exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#timetable$/);
  await expect(
    page.getByRole("tab", { name: "Week D", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => savedProject(page)).toEqual(project);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: project.name, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("received-timetable.png"),
    fullPage: true,
  });
  expect(await backup(page)).toEqual(fixture);
  expect(errors).toEqual([]);
});

test("cancelled and damaged transfers preserve an existing timetable", async ({
  page,
}) => {
  const existing = { ...project, name: "Keep my existing timetable" };
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    { key: STORAGE_KEY, data: serializeProject(existing) },
  );
  await page.goto(`./${await encodeTransfer(project)}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("This adds a separate timetable");
  const downloading = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Back up current timetable" })
    .click();
  expect(
    JSON.parse(await readFile((await (await downloading).path())!, "utf8"))
      .timetable,
  ).toEqual(existing);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: existing.name, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    location.hash = "transfer=1.broken";
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Your saved timetable has not been changed",
  );
  await expect(
    page.getByRole("button", { name: "Use this timetable" }),
  ).toHaveCount(0);
  expect(await savedProject(page)).toEqual(existing);
});

test("an unfinished timetable resumes at its saved setup step", async ({
  page,
}) => {
  const draft = { ...project, setupComplete: false, setupStep: 4 };
  await page.goto(`./${await encodeTransfer(draft)}`);
  await page.getByRole("button", { name: "Use this timetable" }).click();
  await expect(page).toHaveURL(/#subjects$/);
  expect(await savedProject(page)).toEqual(draft);
});
