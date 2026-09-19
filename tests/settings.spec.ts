import { expect, test, type Page } from "@playwright/test";
import { sampleProject } from "../src/domain/fixture";
import { serializeProject, STORAGE_KEY } from "../src/domain/persistence";
import { decodeTransfer, encodeTransfer } from "../src/domain/transfer";
import { savedProject } from "./storage";

async function navigation(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  return page.locator(".sidebar");
}

test("all original setup steps resume on the correct page without changing saved settings", async ({
  page,
}) => {
  const pages = [
    "School year & rotation",
    "School year & rotation",
    "Holidays & days off",
    "Lesson times",
    "Subjects",
    "Build timetable",
    "Lesson preview",
  ];
  await page.goto("./");
  for (const [setupStep, name] of pages.entries()) {
    const project = { ...sampleProject(), setupComplete: false, setupStep };
    await page.evaluate(
      ({ key, raw }) => {
        localStorage.clear();
        localStorage.setItem(key, raw);
      },
      { key: STORAGE_KEY, raw: serializeProject(project) },
    );
    await page.goto("./");
    const sidebar = await navigation(page);
    await expect(
      sidebar.getByRole("button", { name: new RegExp(name + "$") }),
    ).toHaveAttribute("aria-current", "step");
    expect(await savedProject(page)).toEqual(project);
    const close = sidebar.getByRole("button", { name: "Close navigation" });
    if (await close.isVisible()) await close.click();
    await expect(
      page.getByRole("progressbar", { name: "Timetable setup" }),
    ).toHaveAttribute("aria-valuemax", "6");
  }
});

test("old rotation links show combined settings and unnamed drafts can be named in Your timetables", async ({
  page,
}) => {
  const project = {
    ...sampleProject(),
    name: "",
    setupComplete: false,
    setupStep: 1,
  };
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: serializeProject(project),
  });
  await page.goto("./#rotation");
  await expect(page.getByLabel("First day of school")).toHaveValue(
    project.academicYear.startDate,
  );
  await expect(page.getByLabel("School time zone")).toHaveValue(
    project.academicYear.timezone,
  );
  await expect(
    page.getByRole("button", { name: "2 week cycle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Timetable name")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Name timetable", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Your timetables" });
  await dialog.getByLabel("Timetable name").fill("My school");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/#holidays$/);
  expect(await savedProject(page)).toEqual({
    ...project,
    name: "My school",
    setupStep: 2,
    updatedAt: expect.any(String),
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/#year$/);
  await expect(page.getByLabel("First day of school")).toHaveValue(
    project.academicYear.startDate,
  );
});

for (const kind of ["backup", "transfer"] as const) {
  test(`an older rotation draft received by ${kind} opens the merged page`, async ({
    page,
  }) => {
    const project = { ...sampleProject(), setupComplete: false, setupStep: 1 };
    await page.goto("./");
    if (kind === "backup") {
      page.once("dialog", (d) => d.accept());
      await page.getByLabel("Import project file").setInputFiles({
        name: "draft.json",
        mimeType: "application/json",
        buffer: Buffer.from(serializeProject(project)),
      });
    } else {
      await page.evaluate(
        (hash) => {
          location.hash = hash;
        },
        await encodeTransfer(project),
      );
      await page.getByRole("button", { name: "Use this timetable" }).click();
    }
    await expect(page).toHaveURL(/#year$/);
    await expect(page.getByLabel("First day of school")).toHaveValue(
      project.academicYear.startDate,
    );
    await expect(
      page.getByRole("button", { name: "2 week cycle", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await savedProject(page)).toEqual(
      kind === "transfer"
        ? await decodeTransfer(await encodeTransfer(project))
        : project,
    );
  });
}

test("Install app sits above Help & privacy and opens instructions or the browser prompt", async ({
  page,
}) => {
  await page.goto("./");
  const sidebar = await navigation(page);
  const utility = sidebar.locator(".sidebar-utility");
  await expect(utility.getByRole("button")).toHaveText([
    "Install app",
    "Help & privacy",
  ]);
  await expect(
    sidebar.getByRole("button", { name: "New timetable", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("main")
      .getByRole("button", { name: "Install app", exact: true }),
  ).toHaveCount(0);
  await utility
    .getByRole("button", { name: "Install app", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Keep SchoolCal close by" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installPrompted = "true";
      },
    });
    window.dispatchEvent(event);
  });
  await navigation(page);
  await utility
    .getByRole("button", { name: "Install app", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-install-prompted",
    "true",
  );
  await expect(dialog).toHaveCount(0);
});
