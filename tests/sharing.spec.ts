import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";

test.describe.configure({ timeout: 60_000 });

async function openExport(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: /Try a sample/ }).click();
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Export & share", exact: true })
    .click();
}

async function mockSharing(page: Page, result = "success") {
  await page.addInitScript((result) => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => !!data.files?.[0]?.size,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        if (result !== "success")
          throw new DOMException("Permission denied", result);
        const file = data.files![0];
        sessionStorage.setItem(
          "sharedCalendar",
          JSON.stringify({
            title: data.title,
            name: file.name,
            type: file.type,
            content: await file.text(),
          }),
        );
      },
    });
  }, result);
}

function events(content: string) {
  return new ICAL.Component(ICAL.parse(content)).getAllSubcomponents("vevent");
}

test("sharing sends the same complete calendar file as download and respects export options", async ({
  page,
}) => {
  await mockSharing(page);
  await openExport(page);
  const share = page.getByRole("button", {
    name: "Share calendar file",
    exact: true,
  });
  await share.click();
  await expect(page.locator(".toast")).toContainText(
    "Calendar file passed to your device’s sharing menu.",
  );
  const first = JSON.parse(
    await page.evaluate(() => sessionStorage.getItem("sharedCalendar")!),
  );
  expect(first.title).toBe("Sample timetable");
  expect(first.name).toBe("sample-timetable-timetable.ics");
  expect(first.type).toBe("text/calendar");
  expect(events(first.content).length).toBeGreaterThan(500);
  await page.getByRole("checkbox", { name: /Include fixed periods/ }).check();
  await share.click();
  await expect
    .poll(async () => {
      const shared = JSON.parse(
        await page.evaluate(() => sessionStorage.getItem("sharedCalendar")!),
      );
      return events(shared.content).length;
    })
    .toBeGreaterThan(events(first.content).length);
  const updated = JSON.parse(
    await page.evaluate(() => sessionStorage.getItem("sharedCalendar")!),
  );
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .ics", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(updated.name);
  expect(await readFile((await download.path())!, "utf8")).toBe(
    updated.content,
  );
});

for (const error of ["NotAllowedError", "DataError", "TypeError"]) {
  test(`${error} offers a working download instead of a raw sharing error`, async ({
    page,
  }, testInfo) => {
    await mockSharing(page, error);
    await openExport(page);
    await page
      .getByRole("button", { name: "Share calendar file", exact: true })
      .click();
    await expect(
      page.getByText("Permission denied", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("#calendar-share-help")).toContainText(
      "Your browser couldn’t open sharing.",
    );
    const fallback = page.getByRole("button", {
      name: "Download to share",
      exact: true,
    });
    await expect(fallback).toBeEnabled();
    if (error === "NotAllowedError") {
      await page.screenshot({
        path: testInfo.outputPath("sharing-fallback.png"),
        fullPage: true,
      });
    }
    const downloading = page.waitForEvent("download");
    await fallback.click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
    expect(
      events(await readFile((await download.path())!, "utf8")).length,
    ).toBeGreaterThan(500);
    await expect(page.locator(".toast")).toContainText(
      "Calendar file downloaded.",
    );
  });
}

test("cancelling sharing leaves the calendar available without downloading or reporting success", async ({
  page,
}) => {
  await mockSharing(page, "AbortError");
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await openExport(page);
  await page
    .getByRole("button", { name: "Share calendar file", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Share calendar file", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Download to share", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(
      ".export-share-page .notice.success, .export-share-page .notice.error",
    ),
  ).toHaveCount(0);
  expect(downloads).toEqual([]);
});

test("unsupported or failing sharing detection keeps export usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const mode = new URL(location.href).searchParams.get("sharing");
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value:
        mode === "absent"
          ? undefined
          : () => {
              if (mode === "throws")
                throw new DOMException("Blocked", "NotAllowedError");
              return mode === "no-share-method";
            },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value:
        mode === "no-share-method"
          ? undefined
          : async () => {
              throw new Error("Must not share");
            },
    });
  });
  for (const mode of ["absent", "unsupported", "throws", "no-share-method"]) {
    await page.goto(`./?sharing=${mode}`);
    if (await page.getByRole("button", { name: /Try a sample/ }).isVisible()) {
      await page.getByRole("button", { name: /Try a sample/ }).click();
    }
    const menu = page.getByRole("button", { name: "Open navigation" });
    if (await menu.isVisible()) await menu.click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Export & share", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Share calendar file", exact: true }),
    ).toHaveCount(0);
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download .ics", exact: true })
      .click();
    expect((await downloading).suggestedFilename()).toMatch(/\.ics$/);
  }
  expect(errors).toEqual([]);
});
