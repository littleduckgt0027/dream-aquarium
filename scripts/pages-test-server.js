import express from "express";
import { resolve } from "node:path";
process.env.DB_PATH = "/tmp/dream-pages-test.sqlite";
process.env.PUBLIC_ORIGIN = "http://127.0.0.1:3202";
process.env.FRONTEND_ORIGIN = "http://127.0.0.1:3201";
process.env.COOKIE_SECURE = "false";
const { createApp } = await import("../backend/server.js");
const db = process.env.TEST_DATABASE_URL
  ? await (await import("../tests/helpers/database.js")).testDatabase()
  : undefined;
const api = await createApp({ db, production: true });
const backend = api.listen(3202, "127.0.0.1");
const site = express();
site.use("/dream-aquarium", express.static(resolve("dist-pages")));
const frontend = site.listen(3201, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, async () => {
    await Promise.all(
      [backend, frontend].map((s) => new Promise((r) => s.close(r))),
    );
    await api.locals.db.close();
    process.exit(0);
  });
