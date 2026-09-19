import type { Page } from "@playwright/test";
import {
  activeTimetable,
  parseLibrary,
  TIMETABLES_KEY,
} from "../src/domain/timetables";

export async function savedLibrary(page: Page) {
  return parseLibrary(
    await page.evaluate((key) => localStorage.getItem(key)!, TIMETABLES_KEY),
  );
}
export async function savedProject(page: Page) {
  return activeTimetable(await savedLibrary(page));
}

export async function renameTimetable(page: Page, name: string) {
  const current = await savedProject(page);
  await page.getByRole("button", { name: /^Switch timetable:/ }).click();
  const dialog = page.getByRole("dialog", { name: "Your timetables" });
  if (current.name.trim())
    await dialog
      .getByRole("button", { name: `Rename ${current.name}`, exact: true })
      .click();
  await dialog.getByLabel("Timetable name").fill(name);
  await dialog.getByRole("button", { name: "Save name" }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
}
