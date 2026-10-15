import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/pages",
  outputDir: "test-results/pages",
  workers: 1,
  use: {
    actionTimeout: 10000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL: "http://127.0.0.1:3201",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "node scripts/pages-test-server.js",
    url: "http://127.0.0.1:3202/api/health",
  },
  reporter: "list",
});
