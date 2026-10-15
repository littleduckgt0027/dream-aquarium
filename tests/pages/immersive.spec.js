import { test, expect } from "@playwright/test";
import { messages } from "../../frontend/src/i18n/catalog.js";
async function register(page) {
  await page.addInitScript(() => localStorage.setItem("dreamLanguage", "en"));
  await page.goto("/dream-aquarium/");
  await page.locator('input[name="username"]').fill("immersive_" + Date.now());
  await page.locator('input[name="password"]').fill("immersive-password");
  await page.locator(".auth-form form button").click();
  await page
    .getByRole("button", { name: "I have saved my recovery code", exact: true })
    .click();
  await expect(page.locator(".avatar")).toBeVisible();
}
const full = (page) =>
  page
    .locator(".aquarium-header-actions")
    .getByRole("button", { name: "Fullscreen Aquarium", exact: true });
const background = (page) =>
  page.locator(".aquarium-header-actions [aria-pressed]");
test("fallback fullscreen, keyboard exit, idle toolbar, refresh and responsive view reuse the living canvas", async ({
  page,
}) => {
  await page.addInitScript(
    () => (Element.prototype.requestFullscreen = undefined),
  );
  await register(page);
  await page.evaluate(
    () =>
      (window.originalCanvas = document.querySelector(
        ".aquarium-stage canvas",
      )),
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await full(page).click();
    const stage = page.locator(".aquarium-stage");
    await expect(stage).toHaveClass(/immersive/);
    expect(await stage.boundingBox()).toMatchObject({
      x: 0,
      y: 0,
      width,
      height: 900,
    });
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Exit Fullscreen", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          window.originalCanvas ===
          document.querySelector(".aquarium-stage canvas"),
      ),
    ).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        document
          .querySelector(".aquarium-stage")
          .contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(stage).not.toHaveClass(/immersive/);
    await expect(full(page)).toBeFocused();
  }
  await full(page).click();
  await page.evaluate(() => document.activeElement.blur());
  await expect(page.locator(".immersive-toolbar")).toHaveClass(/idle/, {
    timeout: 5000,
  });
  await page.mouse.move(30, 40);
  await expect(page.locator(".immersive-toolbar")).not.toHaveClass(/idle/);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document
        .querySelector(".aquarium-stage")
        .contains(document.activeElement),
    ),
  ).toBe(true);
  await expect(page.locator(".immersive-toolbar")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "artifacts/immersive-mobile.png" });
  await page.reload();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/immersive/);
  await page
    .getByRole("button", { name: "Exit Fullscreen", exact: true })
    .click();
  await expect(page.locator(".aquarium-stage")).not.toHaveClass(/immersive/);
  await expect(page.locator(".aquarium-stage canvas")).toHaveCount(1);
});
test("background persists, remains interactive across navigation and uses one renderer including customize", async ({
  page,
  context,
}) => {
  await register(page);
  await page.evaluate(
    () =>
      (window.originalCanvas = document.querySelector(
        ".aquarium-stage canvas",
      )),
  );
  await background(page).click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/background/);
  await expect(page.locator(".aquarium-stage")).toHaveCSS(
    "pointer-events",
    "none",
  );
  for (const label of ["Discovery", "Inventory", "Customize", "Aquarium"]) {
    await page
      .locator("nav")
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.locator(".breadcrumb b")).toHaveText(label);
    expect(
      await page.evaluate(
        () =>
          window.originalCanvas ===
          document.querySelector(".aquarium-stage canvas"),
      ),
    ).toBe(true);
    await expect(page.locator(".aquarium-stage canvas")).toHaveCount(1);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/aquarium-background-desktop.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".aquarium-stage canvas")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await page.reload();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/background/);
  await page.locator(".display-trigger").click();
  await page
    .locator(".display-panel")
    .getByRole("button", { name: "Turn Off Aquarium Background", exact: true })
    .click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/inline/);
  await page.reload();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/inline/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".warning")).toBeVisible();
  await full(page).click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/immersive/);
  await page
    .getByRole("button", { name: "Exit Fullscreen", exact: true })
    .click();
  await background(page).click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/background/);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.locator(".warning")).toHaveCount(0);
  await expect(page.locator(".aquarium-stage")).toHaveClass(/background/);
});
test("native fullscreen request, external exit and five translated display controls", async ({
  page,
}) => {
  await register(page);
  await full(page).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator(".aquarium-stage")).toHaveClass(/inline/);
  for (const [code, name] of Object.entries({
    th: "ไทย",
    en: "English",
    "zh-CN": "简体中文",
    ja: "日本語",
    ko: "한국어",
  })) {
    await page.locator(".language-trigger").click();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
    await expect(
      page.locator(".aquarium-header-actions").getByRole("button", {
        name: messages[code]["display.fullscreen"],
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".aquarium-header-actions").getByRole("button", {
        name: messages[code]["display.background"],
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("immersive view retains audio and server heartbeat; maintenance view still opens", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(Error("denied"));
    const Native = window.AudioContext;
    window.audioInstances = [];
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.audioInstances.push(this);
      }
    };
  });
  await register(page);
  await page
    .locator(".global-controls [data-audio-control].control-trigger")
    .click();
  await page.getByRole("button", { name: "Enable sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await full(page).click();
  await expect
    .poll(() => page.evaluate(() => window.audioInstances[0]?.state))
    .toBe("running");
  const heartbeat = await page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/action") &&
      r.request().postDataJSON()?.type === "heartbeat" &&
      r.ok(),
    { timeout: 20000 },
  );
  expect((await heartbeat.json()).id).toBeTruthy();
  expect(await page.evaluate(() => window.audioInstances.length)).toBe(1);
  await page.mouse.move(10, 100);
  await expect(page.locator(".immersive-toolbar")).not.toHaveClass(/idle/);
  await page
    .getByRole("button", { name: "Exit Fullscreen", exact: true })
    .click();
  await page.route(/\/api\/(state|action)$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.maintenance = true;
    body.maintenanceSince = Date.now();
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.locator(".warning")).toContainText("Maintenance");
  await full(page).click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/immersive/);
  await page.keyboard.press("Escape");
  await background(page).click();
  await expect(page.locator(".aquarium-stage")).toHaveClass(/background/);
});
