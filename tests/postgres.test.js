import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDatabase } from "./helpers/database.js";
import {
  openDB,
  openPostgres,
  migrate,
  transaction,
  poolConfig,
  postgresSQL,
} from "../backend/db.js";
import {
  initialState,
  action,
  load,
  publicState,
  settle,
  setMaintenance,
} from "../backend/game.js";
import { createApp } from "../backend/server.js";
import { importSQLite } from "../scripts/import-sqlite.js";

const pgTest = (name, fn) =>
  test(name, { skip: !process.env.TEST_DATABASE_URL }, fn);
const seed = async (db) =>
  transaction(db, async () => {
    for (const id of ["a", "b", "c"])
      await db
        .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .run(id, id, "hash", "recovery", JSON.stringify(initialState()));
  });
const run = (db, id, type, payload) =>
  transaction(db, () => action(db, id, type, payload));

test("remote PostgreSQL TLS always verifies certificates; pool and SQL parameters are bounded", () => {
  const config = poolConfig(
    "postgresql://example.invalid/a?sslmode=no-verify&ssl=false",
  );
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.ok(!config.connectionString.includes("ssl"));
  assert.equal(config.max, 5);
  assert.equal(poolConfig("postgresql://127.0.0.1/test").ssl, false);
  assert.equal(
    postgresSQL("SELECT '?' x, ? y, 'it''s ?' z, ? w"),
    "SELECT '?' x, $1 y, 'it''s ?' z, $2 w",
  );
});

test("Render refuses ephemeral SQLite fallback", () => {
  const old = {
    RENDER: process.env.RENDER,
    DATABASE_URL: process.env.DATABASE_URL,
  };
  process.env.RENDER = "true";
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => openDB(), /DATABASE_URL is required/);
  } finally {
    for (const [key, value] of Object.entries(old))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

pgTest(
  "migrations repeat concurrently and database state survives pool reconnection",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    await Promise.all([migrate(db), migrate(db), migrate(db)]);
    assert.equal(
      (await db.prepare("SELECT count(*) n FROM schema_migrations").get()).n,
      3,
    );
    await seed(db);
    await run(db, "a", "gacha", { count: 1 });
    const before = await load(db, "a");
    const other = await openPostgres(db.testURL);
    await other.close();
    const reconnected = await openPostgres(db.testURL);
    try {
      assert.deepEqual(await load(reconnected, "a"), before);
    } finally {
      await reconnected.close();
    }
  },
);

pgTest(
  "independent pools serialize purchases, bids, refunds, settlement and rollback",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    const other = await openPostgres(db.testURL);
    t.after(() => other.close());
    await seed(db);
    const fish = (await load(db, "a")).fish;
    await run(db, "a", "list", { id: fish[0].id, type: "fixed", price: 1000 });
    const listing = (await publicState(db, "a")).listings[0];
    const purchases = await Promise.allSettled([
      run(db, "b", "buy", { id: listing.id }),
      run(other, "c", "buy", { id: listing.id }),
    ]);
    assert.equal(purchases.filter((p) => p.status === "fulfilled").length, 1);
    assert.equal((await load(db, "a")).pearls, 3900);
    assert.equal(
      (await load(db, "b")).deliveries.length +
        (await load(db, "c")).deliveries.length,
      1,
    );
    await run(db, "a", "list", {
      id: fish[1].id,
      type: "auction",
      price: 100,
      hours: 6,
    });
    const auction = (await publicState(db, "a")).listings[0];
    const bids = await Promise.allSettled([
      run(db, "b", "bid", { id: auction.id, amount: 200 }),
      run(other, "c", "bid", { id: auction.id, amount: 300 }),
    ]);
    assert.ok(bids.some((b) => b.status === "fulfilled"));
    assert.equal(
      (await db.prepare("SELECT bid FROM listings WHERE id=?").get(auction.id))
        .bid,
      300,
    );
    const before = await Promise.all([
      load(db, "a"),
      load(db, "b"),
      load(db, "c"),
    ]);
    const deadline = auction.end_at + 1;
    await assert.rejects(
      transaction(db, async () => {
        await settle(db, deadline);
        throw Error("fault after transfers");
      }),
      /fault/,
    );
    assert.deepEqual(
      await Promise.all([load(db, "a"), load(db, "b"), load(db, "c")]),
      before,
    );
    await Promise.all([
      transaction(db, () => settle(db, deadline)),
      transaction(other, () => settle(other, deadline)),
    ]);
    assert.equal((await load(db, "a")).pearls, 4170);
    assert.equal(
      (await load(db, "b")).deliveries.length +
        (await load(db, "c")).deliveries.length,
      2,
    );
    assert.equal(
      (await load(db, "b")).pearls + (await load(db, "c")).pearls,
      4700,
    );
  },
);

pgTest(
  "SQLite import preserves all tables, original file, ordering and sequences; replay refuses changes",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    const dir = mkdtempSync(join(tmpdir(), "dream-import-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const source = join(dir, "original.sqlite");
    const sqlite = openDB(source);
    await seed(sqlite);
    await run(sqlite, "a", "buyFood", { count: 3 });
    await run(sqlite, "a", "list", {
      id: (await load(sqlite, "a")).fish[0].id,
      type: "auction",
      price: 100,
      hours: 6,
    });
    const listing = (await publicState(sqlite, "a")).listings[0];
    await run(sqlite, "b", "bid", { id: listing.id, amount: 200 });
    await transaction(sqlite, () => setMaintenance(sqlite, true));
    sqlite
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run("tokenhash", "a", Date.now() + 100000);
    sqlite
      .prepare("INSERT INTO requests VALUES(?,?,?,?)")
      .run("a", "import-key", "{}", "ok");
    const tables = [
      "users",
      "sessions",
      "listings",
      "requests",
      "lineage",
      "audit",
      "meta",
    ];
    const before = Object.fromEntries(
      tables.map((n) => [n, sqlite.prepare(`SELECT * FROM ${n}`).all()]),
    );
    const result = await importSQLite(source, db);
    assert.equal(result.users, 3);
    for (const name of tables) {
      const actual = await db.prepare(`SELECT * FROM ${name}`).all();
      const expected = before[name];
      if (name === "listings") expected[0].rowid = 1;
      const sort = (rows) =>
        rows
          .map((r) =>
            JSON.stringify(Object.fromEntries(Object.entries(r).sort())),
          )
          .sort();
      assert.deepEqual(sort(actual), sort(expected), name);
    }
    await assert.rejects(importSQLite(source, db), /empty destination/);
    assert.equal((await db.prepare("SELECT count(*) n FROM users").get()).n, 3);
    assert.deepEqual(sqlite.prepare("SELECT * FROM users").all(), before.users);
    await transaction(db, () => setMaintenance(db, false));
    await run(db, "a", "buyFood", { count: 1 });
    await run(db, "a", "list", {
      id: (await load(db, "a")).fish[0].id,
      type: "fixed",
      price: 100,
    });
    assert.equal(
      (await db.prepare("SELECT count(*) n FROM listings").get()).n,
      2,
    );
    sqlite.close();
  },
);

pgTest(
  "invalid import rolls back partially inserted users and never edits source",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    const dir = mkdtempSync(join(tmpdir(), "dream-invalid-import-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, "bad.sqlite"),
      source = openDB(file);
    for (const [id, name] of [
      ["a", "Keeper"],
      ["b", "keeper"],
    ])
      source
        .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .run(id, name, "hash", "hash", JSON.stringify(initialState()));
    await assert.rejects(importSQLite(file, db), (e) => e.code === "23505");
    assert.equal((await db.prepare("SELECT count(*) n FROM users").get()).n, 0);
    assert.equal(source.prepare("SELECT count(*) n FROM users").get().n, 2);
    source.close();
  },
);

pgTest("HTTP health fails closed on database outage", async (t) => {
  const db = await testDatabase();
  t.after(() => db.close());
  const app = await createApp({ db, production: true }),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/health`;
  assert.equal((await (await fetch(url)).json()).databaseEngine, "postgresql");
  const prepare = db.prepare;
  db.prepare = () => {
    throw Error("simulated database outage");
  };
  const bad = await fetch(url);
  assert.equal(bad.status, 503);
  assert.equal((await bad.json()).database, "unavailable");
  db.prepare = prepare;
  assert.equal((await fetch(url)).status, 200);
});

pgTest(
  "real backend process restart retains sessions, action keys, maintenance, fish and money",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    let child;
    async function start() {
      child = spawn(process.execPath, ["backend/server.js"], {
        env: {
          ...process.env,
          DATABASE_URL: db.testURL,
          NODE_ENV: "production",
          PORT: "0",
          HOST: "127.0.0.1",
          COOKIE_SECURE: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      // Port 0 is assigned by the OS; server logs actual bound port.
      let output = "";
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Backend startup timed out")),
          20000,
        );
        child.stdout.on("data", (data) => {
          output += data;
          const m = output.match(/listening on port (\d+)/);
          if (m) {
            clearTimeout(timer);
            resolve(Number(m[1]));
          }
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(Error("Backend exited before ready"));
        });
      });
      return `http://127.0.0.1:${port}/api/`;
    }
    async function stop() {
      const done = once(child, "exit");
      child.kill("SIGTERM");
      await done;
      child = undefined;
    }
    t.after(async () => {
      if (child) await stop();
    });
    let url = await start();
    const registered = await fetch(url + "auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "restart_keeper",
        password: "restart-password-123",
      }),
    });
    assert.equal(registered.status, 200);
    const cookie = registered.headers.get("set-cookie").split(";")[0];
    const headers = {
      Cookie: cookie,
      "Content-Type": "application/json",
      "Idempotency-Key": "restart-gacha-key",
    };
    const body = JSON.stringify({ type: "gacha", payload: { count: 1 } });
    const first = await (
      await fetch(url + "action", { method: "POST", headers, body })
    ).json();
    assert.equal(first.pearls, 2900);
    async function itemAction(type, payload, key) {
      const r = await fetch(url + "action", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": key },
        body: JSON.stringify({ type, payload }),
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    const items = await itemAction(
      "itemGacha",
      { category: "decoration", count: 10 },
      "restart-item-roll",
    );
    const placed = items.lastItemRoll[0];
    await itemAction(
      "itemPlace",
      { id: placed.id, x: 0.4, y: 0.8, rotation: 15, scale: 1.2 },
      "restart-placement",
    );
    const snapshot = await itemAction(
      "itemPreview",
      { category: "decoration", operation: "delete" },
      "restart-item-preview",
    );
    assert.equal(snapshot.itemPreview.total, 9);
    await db
      .prepare(
        "INSERT INTO collectible_tickets(user_id,category,rarity,quantity) VALUES(?,?,?,?)",
      )
      .run(first.id, "background", 4, 7);

    await stop();
    url = await start();
    const replay = await fetch(url + "action", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(replay.status, 200);
    const after = await replay.json();
    assert.equal(after.pearls, 2000);
    assert.equal(after.cosmetics.placements[0].id, placed.id);
    assert.equal(after.cosmetics.placements[0].rotation, 15);
    assert.equal(after.itemPreview.id, snapshot.itemPreview.id);
    await itemAction(
      "itemCommit",
      { previewId: snapshot.itemPreview.id, confirm: true },
      "restart-item-commit",
    );
    const inventory = await (
      await fetch(url + "items?category=decoration", { headers })
    ).json();
    assert.equal(inventory.total, 1);
    assert.equal(inventory.tickets[0].quantity, 7);
    assert.deepEqual(
      after.fish.map((f) => f.id),
      first.fish.map((f) => f.id),
    );
    await transaction(db, () => setMaintenance(db, true));
    await stop();
    url = await start();
    assert.equal(
      (await (await fetch(url + "state", { headers })).json()).maintenance,
      true,
    );
    assert.equal(
      (
        await fetch(url + "action", {
          method: "POST",
          headers: { ...headers, "Idempotency-Key": "blocked-restart-key" },
          body,
        })
      ).status,
      400,
    );
    await transaction(db, () => setMaintenance(db, false));
    assert.equal(
      (await (await fetch(url + "state", { headers })).json()).pearls,
      2000,
    );
    await stop();
  },
);

pgTest(
  "two API instances share durable idempotency and serialize case-insensitive signup and recovery",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    const other = await openPostgres(db.testURL);
    t.after(() => other.close());
    const servers = [];
    for (const connection of [db, other]) {
      const app = await createApp({ db: connection, production: true });
      const server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      servers.push(server);
      t.after(() => new Promise((r) => server.close(r)));
    }
    const urls = servers.map(
      (s) => `http://127.0.0.1:${s.address().port}/api/`,
    );
    const post = async (url, path, body, headers = {}) => {
      const r = await fetch(url + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    };
    const signups = await Promise.all(
      urls.map((url, i) =>
        post(url, "auth/register", {
          username: i ? "KEEPER_RACE" : "keeper_race",
          password: "race-password-123",
        }),
      ),
    );
    assert.deepEqual(signups.map((s) => s.status).sort(), [200, 400]);
    const account = signups.find((s) => s.status === 200),
      headers = {
        Cookie: account.cookie,
        "Idempotency-Key": "cross-instance-roll",
      };
    const rolls = await Promise.all(
      urls.map((url) =>
        post(url, "action", { type: "gacha", payload: { count: 1 } }, headers),
      ),
    );
    assert.ok(rolls.every((r) => r.status === 200 && r.data.pearls === 2900));
    assert.equal(
      (await db.prepare("SELECT count(*) n FROM requests").get()).n,
      1,
    );
    const listedFish = rolls[0].data.fish[0];
    assert.equal(
      (
        await post(
          urls[0],
          "action",
          {
            type: "list",
            payload: { id: listedFish.id, type: "fixed", price: 100 },
          },
          { ...headers, "Idempotency-Key": "filter-list-key" },
        )
      ).status,
      200,
    );
    const query = new URLSearchParams({
      search: listedFish.name,
      rarity: String(listedFish.rarity),
      type: "fixed",
      sort: "price",
    });
    const market = await (
      await fetch(urls[1] + "market?" + query, {
        headers: { Cookie: account.cookie },
      })
    ).json();
    assert.equal(market.total, 1);
    assert.equal(market.items[0].fish.id, listedFish.id);
    const recovery = await Promise.all(
      urls.map((url) =>
        post(url, "auth/recover", {
          username: "keeper_race",
          password: "replacement-password",
          recovery: account.data.recoveryCode,
        }),
      ),
    );
    assert.deepEqual(recovery.map((r) => r.status).sort(), [200, 400]);
    assert.equal(
      (
        await post(
          urls[0],
          "action",
          { type: "gacha", payload: { count: 1 } },
          { ...headers, "Idempotency-Key": "revoked-session-key" },
        )
      ).status,
      401,
    );
  },
);

pgTest(
  "pool reconnects after a server-side connection termination without losing committed state",
  async (t) => {
    const db = await testDatabase();
    t.after(() => db.close());
    await seed(db);
    await run(db, "a", "buyFood", { count: 1 });
    const before = await load(db, "a");
    // Killing this test pool's checked-out connection simulates an idle connection
    // dropped by the database. No production backend is contacted.
    const victim = await db.pool.connect();
    const pid = (await victim.query("SELECT pg_backend_pid() pid")).rows[0].pid;
    const disconnected = new Promise((resolve) =>
      victim.once("error", resolve),
    );
    await db.pool.query("SELECT pg_terminate_backend($1)", [pid]);
    await disconnected;
    victim.release(true);
    assert.deepEqual(await load(db, "a"), before);
    await run(db, "a", "buyFood", { count: 1 });
    assert.equal((await load(db, "a")).pearls, 2960);
  },
);

test("Render rejects insecure cookies and malformed public origins before database access", async () => {
  const names = [
    "RENDER",
    "COOKIE_SECURE",
    "TRUST_PROXY_HOPS",
    "PUBLIC_ORIGIN",
    "FRONTEND_ORIGIN",
  ];
  const old = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  Object.assign(process.env, {
    RENDER: "true",
    COOKIE_SECURE: "false",
    TRUST_PROXY_HOPS: "1",
    PUBLIC_ORIGIN: "https://backend.example",
    FRONTEND_ORIGIN: "https://keeper.example",
  });
  try {
    await assert.rejects(createApp({ production: true }), /COOKIE_SECURE/);
    process.env.COOKIE_SECURE = "true";
    process.env.FRONTEND_ORIGIN = "https://keeper.example/dream-aquarium/";
    await assert.rejects(createApp({ production: true }), /without a path/);
  } finally {
    for (const [name, value] of Object.entries(old))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
