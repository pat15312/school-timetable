import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { testProject } from "../src/domain/test-helpers";
import { serializeProject, STORAGE_KEY } from "../src/domain/persistence";
import { savedLibrary } from "./storage";

// Serve two revisions of the production app on an isolated origin. Only the HTML
// marker and its precache revision change; the real generated worker handles updates.
async function deployment() {
  let version = 1;
  const base = process.env.BASE_PATH || "/";
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, "http://localhost").pathname;
      const name = pathname.slice(base.length) || "index.html";
      if (!pathname.startsWith(base) || name.includes("..")) {
        response.writeHead(404).end();
        return;
      }
      let bytes: string | Buffer = await readFile(resolve("dist", name));
      if (name === "index.html")
        bytes = bytes
          .toString()
          .replace(
            "<head>",
            `<head><meta name="test-deployment" content="${version}">`,
          );
      if (name === "sw.js")
        bytes = bytes
          .toString()
          .replace(
            /url:"index.html",revision:"[^"]+"/,
            `url:"index.html",revision:"test-deployment-${version}"`,
          );
      const extension = name.split(".").pop()!;
      response.writeHead(200, {
        "Content-Type":
          (
            {
              js: "application/javascript",
              html: "text/html",
              css: "text/css",
              png: "image/png",
              svg: "image/svg+xml",
              webmanifest: "application/manifest+json",
            } as Record<string, string>
          )[extension] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}${base}`,
    update: () => {
      version++;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test("Save and reload handles a waiting update, another tab's activation, and offline reopening", async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);
  const server = await deployment();
  try {
    await page.addInitScript(
      ({ key, value }) => {
        if (!localStorage.getItem("schoolcal.timetables.v1"))
          localStorage.setItem(key, value);
      },
      { key: STORAGE_KEY, value: serializeProject(testProject()) },
    );
    await page.goto(`${server.url}#export`);
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
    await expect(
      page.getByRole("button", { name: "Save and reload", exact: true }),
    ).toHaveCount(0);
    const before = await savedLibrary(page);
    server.update();
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(
      page.getByRole("button", { name: "Save and reload", exact: true }),
    ).toBeVisible();
    // Register a new page while the update is already waiting. Workbox's isUpdate
    // flag does not reliably cover this case, which previously left the page stale.
    const other = await context.newPage();
    await other.goto(`${server.url}#export`);
    await expect(other.locator('meta[name="test-deployment"]')).toHaveAttribute(
      "content",
      "1",
    );
    await expect(
      other.getByRole("button", { name: "Save and reload", exact: true }),
    ).toBeVisible();
    await Promise.all([
      other.waitForEvent("load"),
      other
        .getByRole("button", { name: "Save and reload", exact: true })
        .click(),
    ]);
    await expect(other.locator('meta[name="test-deployment"]')).toHaveAttribute(
      "content",
      "2",
    );
    expect(await savedLibrary(other)).toEqual(before);
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      "content",
      "1",
    );
    await Promise.all([
      page.waitForEvent("load"),
      page
        .getByRole("button", { name: "Save and reload", exact: true })
        .click(),
    ]);
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      "content",
      "2",
    );
    expect(await savedLibrary(page)).toEqual(before);
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Edit in a spreadsheet" }),
    ).toBeVisible();
    expect(await savedLibrary(page)).toEqual(before);
  } finally {
    await server.close();
  }
});

test("Save and reload rechecks storage before activating an update", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const server = await deployment();
  try {
    await page.goto(server.url);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    server.update();
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect(
      page.getByRole("button", { name: "Save and reload", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Full", "QuotaExceededError");
      };
    });
    await page
      .getByRole("button", { name: "Save and reload", exact: true })
      .click();
    await expect(
      page.getByText(/Your browser could not save your timetables/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        async () => !!(await navigator.serviceWorker.ready).waiting,
      ),
    ).toBe(true);
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      "content",
      "1",
    );
  } finally {
    await server.close();
  }
});
