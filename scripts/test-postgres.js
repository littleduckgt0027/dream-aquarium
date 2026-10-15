import { spawnSync } from "node:child_process";
if (!process.env.TEST_DATABASE_URL)
  throw Error(
    "TEST_DATABASE_URL must point to a disposable PostgreSQL test database",
  );
const r = spawnSync(
  process.execPath,
  [
    "--test",
    "tests/admin-balance.test.js",
    "tests/game.test.js",
    "tests/inventory.test.js",
    "tests/api.test.js",
    "tests/cors.test.js",
    "tests/postgres.test.js",
  ],
  { stdio: "inherit", env: process.env },
);
process.exitCode = r.status ?? 1;
