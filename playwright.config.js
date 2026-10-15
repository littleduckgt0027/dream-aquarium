import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "DB_PATH=/tmp/dream-e2e.sqlite PORT=3100 COOKIE_SECURE=false npm start",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
