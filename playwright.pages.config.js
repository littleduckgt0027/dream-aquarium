import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/pages",
  workers: 1,
  use: {
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
