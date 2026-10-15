import { test, expect } from "@playwright/test";
test("real keeper journey, fish management, breeding, gacha, navigation and offline", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Begin your journey" }),
  ).toBeVisible();
  await page
    .getByLabel("Username", { exact: true })
    .fill("keeper_" + Date.now());
  await page.getByLabel("Password", { exact: true }).fill("ocean-password-123");
  await page.getByRole("button", { name: "Create aquarium →" }).click();
  await page
    .getByRole("button", { name: "I have saved my recovery code" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your little ocean." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Living aquarium with swimming procedural fish"),
  ).toBeVisible();
  await expect(page.getByText("3,000", { exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/aquarium-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Fish storage", exact: false })
    .first()
    .click();
  await expect(page.locator(".fish-card")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Store", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Add to tank", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Add to tank", exact: true }).click();
  await page
    .getByRole("button", { name: "Breeding", exact: false })
    .first()
    .click();
  const opts = await page
    .getByLabel("Parent 1")
    .locator("option")
    .evaluateAll((a) => a.map((x) => x.value));
  await page.getByLabel("Parent 1").selectOption(opts[1]);
  await page.getByLabel("Parent 2").selectOption(opts[2]);
  await page.getByRole("button", { name: "Begin breeding · 200 ◈" }).click();
  await expect(page.getByText(/Incubating/)).toBeVisible();
  await page
    .getByRole("button", { name: "Discovery", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Discover ×1 · 100 ◈", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your discoveries · 1" }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Buy food · 20 Pearl each", exact: true })
    .click();
  await expect(page.getByText("Food ×1 / 999", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Growing fish", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Feed one serving", exact: true })
    .click();
  await expect(page.getByText("Food ×1 / 999", { exact: true })).toHaveCount(0);
  for (const [nav, title] of [
    ["Marketplace", "Find a new favorite."],
    ["Online rewards", "Stay a little longer."],
    ["Monthly collection", "The moonlit collection."],
    ["Inboxes", "Something for you."],
    ["Inventory", "Little things, big possibilities."],
    ["Customize", "Your ocean, your way."],
    ["Settings", "A quieter kind of play."],
  ]) {
    await page
      .locator("nav")
      .getByRole("button", { name: nav, exact: false })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page
    .locator("nav")
    .getByRole("button", { name: "Aquarium", exact: false })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/aquarium-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Connection lost/)).toBeVisible();
  await expect(
    page.getByLabel("Living aquarium with swimming procedural fish"),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.getByText(/Connection lost/)).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Breeding", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Welcome offspring", exact: true }),
  ).toBeVisible({ timeout: 130000 });
  await page
    .getByRole("button", { name: "Welcome offspring", exact: true })
    .click();
  await expect(page.getByText("Welcomed to collection")).toBeVisible();
  expect(errors).toEqual([]);
});
test("two real accounts trade fish, claim delivery and bid through the UI", async ({
  browser,
}) => {
  const contexts = [await browser.newContext(), await browser.newContext()];
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const names = ["seller_" + Date.now(), "buyer_" + Date.now()];
  try {
    for (let i = 0; i < 2; i++) {
      const page = pages[i];
      await page.goto("/");
      await page.getByLabel("Username", { exact: true }).fill(names[i]);
      await page
        .getByLabel("Password", { exact: true })
        .fill("market-password-123");
      await page.getByRole("button", { name: "Create aquarium →" }).click();
      await page
        .getByRole("button", { name: "I have saved my recovery code" })
        .click();
      await page
        .locator("nav")
        .getByRole("button", { name: "Marketplace", exact: false })
        .click();
    }
    const [seller, buyer] = pages;
    const form = seller.locator(".listing-form");
    await form.locator("[name=id]").selectOption({ index: 1 });
    await form.locator("[name=price]").fill("750");
    await form
      .getByRole("button", { name: "Create listing", exact: true })
      .click();
    await expect(
      seller.locator(".listing").filter({ hasText: names[0] }),
    ).toHaveCount(1);
    await buyer.reload();
    await buyer
      .locator("nav")
      .getByRole("button", { name: "Marketplace", exact: false })
      .click();
    const row = buyer.locator(".listing").filter({ hasText: names[0] });
    await expect(row).toHaveCount(1);
    buyer.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Buy 750 ◈", exact: true }).click();
    await expect(buyer.getByText("2,250", { exact: true })).toBeVisible();
    await buyer
      .locator("nav")
      .getByRole("button", { name: "Inboxes", exact: false })
      .click();
    await buyer
      .getByRole("button", { name: "Move to storage", exact: true })
      .click();
    await expect(
      buyer.locator(".inbox-row").getByText("Claimed", { exact: true }),
    ).toBeVisible();
    await form.locator("[name=id]").selectOption({ index: 1 });
    await form.locator("[name=type]").selectOption("auction");
    await form.locator("[name=price]").fill("100");
    await form.locator("[name=buyout]").fill("1000");
    await form
      .getByRole("button", { name: "Create listing", exact: true })
      .click();
    await expect(
      seller.locator(".listing").filter({ hasText: "Auction" }),
    ).toHaveCount(1);
    await buyer
      .locator("nav")
      .getByRole("button", { name: "Marketplace", exact: false })
      .click();
    const auction = buyer.locator(".listing").filter({ hasText: names[0] });
    await expect(auction.getByText("Auction", { exact: false })).toBeVisible();
    await auction.getByLabel("Bid amount").fill("500");
    await auction
      .getByRole("button", { name: "Place bid", exact: true })
      .click();
    await expect(buyer.getByText("1,750", { exact: true })).toBeVisible();
    await expect(auction.getByText(/You lead/)).toBeVisible();
    buyer.once("dialog", (d) => d.accept());
    await auction
      .getByRole("button", { name: "Buy 1,000 ◈", exact: true })
      .click();
    await expect(buyer.getByText("1,250", { exact: true })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
test("operator maintenance is visible and blocks purchases until resumed", async ({
  page,
}) => {
  const { openDB } = await import("../../backend/db.js");
  const { setMaintenance } = await import("../../backend/game.js");
  const db = openDB("/tmp/dream-e2e.sqlite");
  try {
    await page.goto("/");
    await page
      .getByLabel("Username", { exact: true })
      .fill("maint_" + Date.now());
    await page
      .getByLabel("Password", { exact: true })
      .fill("maintenance-password");
    await page.getByRole("button", { name: "Create aquarium →" }).click();
    await page
      .getByRole("button", { name: "I have saved my recovery code" })
      .click();
    setMaintenance(db, true);
    await page
      .locator("nav")
      .getByRole("button", { name: "Settings", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Synchronize server state", exact: true })
      .click();
    await expect(
      page.getByText("Maintenance in progress.", { exact: false }),
    ).toBeVisible();
    await page
      .locator("nav")
      .getByRole("button", { name: "Discovery", exact: false })
      .click();
    await expect(
      page.getByRole("button", { name: "Discover ×1 · 100 ◈", exact: true }),
    ).toBeDisabled();
    setMaintenance(db, false);
    await page.getByRole("button", { name: "Reconnect", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Discover ×1 · 100 ◈", exact: true }),
    ).toBeEnabled();
  } finally {
    setMaintenance(db, false);
    db.close();
  }
});
