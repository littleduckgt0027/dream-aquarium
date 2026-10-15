import { spawnSync } from "node:child_process";
let r = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "../dist-pages"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_BASE: "/dream-aquarium/",
      VITE_API_URL: "http://127.0.0.1:3202",
    },
  },
);
if (r.status !== 0) process.exit(r.status || 1);
r = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.pages.config.js",
  ],
  { stdio: "inherit" },
);
if (r.error) throw r.error;
process.exit(r.status ?? 1);
