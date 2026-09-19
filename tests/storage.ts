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
