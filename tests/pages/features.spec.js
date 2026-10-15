import { test, expect } from "@playwright/test";
import { messages, sourceKeys } from "../../frontend/src/i18n/catalog.js";
const names = {
  th: "ไทย",
  "zh-CN": "简体中文",
  ja: "日本語",
  ko: "한국어",
  en: "English",
};
const text = (code, source) => messages[code][sourceKeys[source]];
async function language(page, code) {
  await page.locator(".language-trigger").click();
  await page
    .getByRole("menuitemradio", { name: names[code], exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", code);
}
async function register(page) {
  const username = "multi_" + Date.now();
  await page.goto("/dream-aquarium/");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill("multilingual-password");
  await page.locator(".auth-form form button").click();
  await page
    .getByRole("button", {
      name: text("th", "I have saved my recovery code"),
      exact: true,
    })
    .click();
  await expect(page.locator(".avatar")).toBeVisible();
  return username;
}

test("Thai default, five-language navigation, state preservation, persistence and responsive layouts", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dream-aquarium/");
  await expect(
    page.getByRole("heading", { name: "เริ่มการเดินทาง" }),
  ).toBeVisible();
  const username = await register(page);
  const nav = [
    "Aquarium",
    "Fish storage",
    "Breeding",
    "Discovery",
    "Marketplace",
    "Online rewards",
    "Monthly collection",
    "Inboxes",
    "Inventory",
    "Customize",
    "Profile",
    "Settings",
  ];
  for (const code of Object.keys(names)) {
    await language(page, code);
    for (const label of nav) {
      await page
        .locator("nav")
        .getByRole("button", { name: text(code, label), exact: true })
        .click();
      await expect(page.locator(".breadcrumb b")).toHaveText(text(code, label));
      await expect(page.locator(".content h1").first()).toBeVisible();
    }
    await page
      .locator("nav")
      .getByRole("button", { name: text(code, "Profile"), exact: true })
      .click();
    await expect(page.locator(".content h1")).toHaveText(username);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".language-trigger")).toBeInViewport();
      await expect(page.locator(".pearl")).toBeInViewport();
      await expect(page.locator(".avatar")).toBeInViewport();
      await page.locator(".language-trigger").click();
      const menu = await page.getByRole("menu").boundingBox();
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await language(page, "ja");
  await page
    .locator("nav")
    .getByRole("button", { name: text("ja", "Fish storage"), exact: true })
    .click();
  await page
    .getByRole("textbox", { name: text("ja", "Search fish"), exact: true })
    .fill("preserve_query");
  await language(page, "ko");
  await expect(
    page.getByRole("textbox", { name: text("ko", "Search fish"), exact: true }),
  ).toHaveValue("preserve_query");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator(".avatar")).toBeVisible();
  await language(page, "th");
  await page
    .locator("nav")
    .getByRole("button", { name: text("th", "Aquarium"), exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/multilingual-thai-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator(".language-trigger").click();
  await page.screenshot({
    path: "artifacts/multilingual-thai-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("sound waits for a gesture, keeps preferences through refresh, handles offline/reconnect and one context", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.__audioContexts = [];
    if (Native)
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          window.__audioContexts.push(this);
        }
      };
  });
  await register(page);
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(0);
  await page.locator('.global-controls button[aria-haspopup="dialog"]').click();
  await expect(
    page.getByRole("dialog", { name: text("th", "Sound settings") }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(0);
  await page
    .getByRole("button", { name: text("th", "Enable sound"), exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0]?.state))
    .toBe("running");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      get: () => true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0].state))
    .toBe("suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      get: () => false,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0].state))
    .toBe("running");
  await page.evaluate(() => {
    delete document.hidden;
  });
  for (const [label, value] of [
    ["Master Volume", "38"],
    ["Music Volume", "19"],
    ["Ambient Volume", "23"],
    ["Sound Effects Volume", "14"],
  ]) {
    const slider = page.getByRole("slider", {
      name: new RegExp(text("th", label)),
    });
    await slider.fill(value);
    await expect(slider).toHaveValue(value);
  }
  await page
    .getByRole("checkbox", { name: text("th", "Music"), exact: true })
    .uncheck();
  await page
    .locator(".sound-panel")
    .screenshot({ path: "artifacts/sound-controls-thai.png" });
  await page
    .getByRole("button", { name: text("th", "Mute"), exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0].state))
    .toBe("suspended");
  await page
    .getByRole("button", { name: text("th", "Unmute"), exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0].state))
    .toBe("running");
  await page.keyboard.press("Escape");
  for (const label of ["Discovery", "Inventory", "Aquarium"])
    await page
      .locator("nav")
      .getByRole("button", { name: text("th", label), exact: true })
      .click();
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(
      new RegExp(
        text(
          "th",
          "Connection lost. This is your cached aquarium. Changes are disabled until the server reconnects.",
        ),
      ),
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(0);
  await page.locator('.global-controls button[aria-haspopup="dialog"]').click();
  await expect(
    page.getByRole("slider", { name: new RegExp(text("th", "Music Volume")) }),
  ).toHaveValue("19");
  await expect(
    page.getByRole("checkbox", { name: text("th", "Music"), exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: text("th", "Enable sound"), exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__audioContexts[0].state))
    .toBe("running");
  await page.keyboard.press("Escape");
  await context.setOffline(false);
  await page
    .getByRole("button", { name: text("th", "Reconnect"), exact: true })
    .click();
  await expect(page.locator(".warning")).toHaveCount(0);
  expect(await page.evaluate(() => window.__audioContexts.length)).toBe(1);
});

test("language menu is keyboard accessible and unavailable audio APIs are harmless", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await page.goto("/dream-aquarium/");
  await page.locator(".language-trigger").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".language-trigger").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".language-trigger")).toBeFocused();
  await page.locator('.global-controls button[aria-haspopup="dialog"]').click();
  await expect(page.getByRole("status")).toHaveText(
    "Sound unavailable on this device",
  );
  await page.screenshot({ path: "artifacts/audio-panel-english.png" });
});
