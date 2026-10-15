import { test, expect } from "@playwright/test";
import { messages } from "../../frontend/src/i18n/catalog.js";
async function register(page) {
  await page.addInitScript(() => localStorage.setItem("dreamLanguage", "en"));
  await page.goto("/dream-aquarium/");
  await page.locator('input[name="username"]').fill("items_" + Date.now());
  await page.locator('input[name="password"]').fill("items-password-123");
  await page.locator(".auth-form form button").click();
  await page
    .getByRole("button", { name: "I have saved my recovery code", exact: true })
    .click();
  await expect(page.locator(".avatar")).toBeVisible();
}
const nav = (page, name) =>
  page.locator("nav").getByRole("button", { name, exact: true });
test("real item gacha, placement drag/rotation, background and fish equipment survive refresh without a second canvas", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await register(page);
  await nav(page, "Item Gacha").click();
  for (const category of ["Decorations", "Backgrounds", "Fish Accessories"]) {
    await page
      .locator(".tabs")
      .getByRole("button", { name: category, exact: true })
      .click();
    await expect(page.locator(".odds")).toContainText("3.8%");
    await page.getByRole("button", { name: /^Draw ×1 ·/ }).click();
    await expect(page.getByRole("dialog")).toContainText("100 Pearl");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm operation" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".result-summary")).toContainText("1");
  }
  await nav(page, "Item Collection").click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Decorations", exact: true })
    .click();
  await page
    .locator(".item-card")
    .first()
    .getByRole("button", { name: "Place", exact: true })
    .click();
  await expect(page.locator(".breadcrumb b")).toHaveText("Aquarium Studio");
  await expect(page.locator(".placement-handle")).toHaveCount(1);
  const handle = page.locator(".placement-handle"),
    box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y - 25, { steps: 5 });
  await page.mouse.up();
  await page
    .locator(".placement-editor")
    .getByRole("slider", { name: "Rotation", exact: true })
    .fill("45");
  await page
    .locator(".placement-editor")
    .getByRole("slider", { name: "Size", exact: true })
    .fill("1.5");
  await page
    .getByRole("button", { name: "Save placement", exact: true })
    .click();
  await expect(
    page
      .locator(".placement-editor")
      .getByRole("slider", { name: "Rotation", exact: true }),
  ).toHaveValue("45");
  await nav(page, "Item Collection").click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Backgrounds", exact: true })
    .click();
  await page
    .locator(".item-card")
    .first()
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .locator(".item-card")
    .first()
    .getByRole("button", { name: "Equip", exact: true })
    .click();
  await expect(
    page
      .locator(".item-card")
      .first()
      .getByRole("button", { name: "Unequip", exact: true }),
  ).toBeVisible();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Fish Accessories", exact: true })
    .click();
  const picker = page.getByRole("combobox", {
    name: "Choose a fish",
    exact: true,
  });
  await expect(picker.locator("option")).not.toHaveCount(1);
  await picker.selectOption({ index: 1 });
  await page
    .locator(".item-card")
    .first()
    .getByRole("button", { name: "Equip", exact: true })
    .click();
  await expect(
    page
      .locator(".item-card")
      .first()
      .getByRole("button", { name: "Unequip", exact: true }),
  ).toBeVisible();
  await page.reload();
  await nav(page, "Item Collection").click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Fish Accessories", exact: true })
    .click();
  await expect(
    page
      .locator(".item-card")
      .first()
      .getByRole("button", { name: "Unequip", exact: true }),
  ).toBeVisible();
  await nav(page, "Aquarium").click();
  await expect(page.locator(".aquarium-stage canvas")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/collectible-aquarium.png" });
  expect(errors).toEqual([]);
});
test("filtered cross-page selection preview protects placed items, irreversible delete confirms; new pages localize and fit mobile", async ({
  page,
}) => {
  test.setTimeout(60000);
  await register(page);
  await nav(page, "Item Gacha").click();
  await page.getByRole("button", { name: /^Draw ×10 ·/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm operation" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "Item Collection").click();
  await expect(page.locator(".item-card")).toHaveCount(10);
  await page
    .getByRole("button", {
      name: "Select all matching eligible items",
      exact: true,
    })
    .click();
  await expect(page.getByText("Selected: 10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bulk Recycle", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Remaining");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Permanently Delete", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Exactly 10 items");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm operation" })
    .click();
  await expect(page.locator(".item-card")).toHaveCount(0);
  await nav(page, "Recycling Center").click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Fish", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every fish, a discovery." }),
  ).toBeVisible();
  for (const [code, name] of Object.entries({
    th: "ไทย",
    en: "English",
    "zh-CN": "简体中文",
    ja: "日本語",
    ko: "한국어",
  })) {
    await page.locator(".language-trigger").click();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
    for (const key of [
      "item_gacha",
      "items",
      "stacks",
      "recycling",
      "studio",
    ]) {
      await nav(page, messages[code]["exp." + key]).click();
      await expect(page.locator(".content h1").first()).toBeVisible();
      await page.setViewportSize({ width: 390, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.screenshot({ path: "artifacts/item-inventory-mobile.png" });
});
