import { test, expect } from "@playwright/test";
test("Pages subpath, remote API without third-party cookies, reload, offline and resync", async ({
  page,
  context,
}) => {
  const errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/api/state"))
      failed.push(r.url() + ":" + r.status());
  });
  await page.goto("/dream-aquarium/");
  await page
    .getByLabel("Username", { exact: true })
    .fill("pages_" + Date.now());
  await page.getByLabel("Password", { exact: true }).fill("pages-password-123");
  await page.getByRole("button", { name: "Create aquarium →" }).click();
  await page
    .getByRole("button", { name: "I have saved my recovery code" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your little ocean." }),
  ).toBeVisible();
  expect((await context.cookies("http://127.0.0.1:3202")).length).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your little ocean." }),
  ).toBeVisible();
  await page.locator("nav").getByRole("button", { name: "Discovery" }).click();
  await page
    .getByRole("button", { name: "Discover ×1 · 100 ◈", exact: true })
    .click();
  await expect(page.getByText("2,900", { exact: true })).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Aquarium", exact: false })
    .click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Connection lost/)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.getByText(/Connection lost/)).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("a committed action with a lost 5xx response retries its original key without a second charge", async ({
  page,
}) => {
  await page.goto("/dream-aquarium/");
  await page
    .getByLabel("Username", { exact: true })
    .fill("retry_" + Date.now());
  await page.getByLabel("Password", { exact: true }).fill("retry-password-123");
  await page.getByRole("button", { name: "Create aquarium →" }).click();
  await page
    .getByRole("button", { name: "I have saved my recovery code" })
    .click();
  await expect(page.getByText("3,000", { exact: true })).toBeVisible();
  let injected = false;
  const keys = [];
  await page.route("**/api/action", async (route) => {
    if (route.request().postDataJSON()?.type !== "gacha")
      return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (!injected) {
      injected = true;
      // Let the real backend commit, then simulate failure of its acknowledgement.
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.fulfill({
        response,
        status: 503,
        json: { error: "Acknowledgement lost" },
      });
    } else await route.continue();
  });
  await page.locator("nav").getByRole("button", { name: "Discovery" }).click();
  const roll = page.getByRole("button", {
    name: "Discover ×1 · 100 ◈",
    exact: true,
  });
  await roll.click();
  await expect(page.getByText(/Connection lost/)).toBeVisible();
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.getByText(/Connection lost/)).toHaveCount(0);
  await expect(page.getByText("2,900", { exact: true })).toBeVisible();
  await roll.click();
  await expect(
    page.getByText("Saved to your aquarium", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2,900", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
