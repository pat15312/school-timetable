import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const colourScheme of ["light", "dark"] as const) {
  test(`${colourScheme}: setup, timetable, settings, and export have no WCAG A/AA violations`, async ({
    page,
  }) => {
    const check = async (screen: string) => {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect
        .soft(
          result.violations.map((v) => ({
            rule: v.id,
            elements: v.nodes.map((n) => ({
              selector: n.target,
              reason: n.failureSummary,
            })),
          })),
          screen,
        )
        .toEqual([]);
    };
    await page.emulateMedia({ colorScheme: colourScheme });
    await page.goto("./");
    await page.getByRole("button", { name: "Appearance: Auto" }).click();
    await check("Appearance choices");
    await page.keyboard.press("Escape");
    await check("School year");
    await page.getByRole("button", { name: /Try a sample/ }).click();
    await check("Timetable");
    for (const name of [
      "School year",
      "Timetable rotation",
      "Holidays & days off",
      "Lesson times",
      "Subjects",
      "Calendar & export",
    ]) {
      if (
        await page.getByRole("button", { name: "Open navigation" }).isVisible()
      )
        await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .locator(".sidebar")
        .getByRole("button", { name, exact: true })
        .click();
      await check(name);
    }
  });
}
