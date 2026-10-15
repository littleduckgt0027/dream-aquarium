import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./helpers/database.js";
import {
  initialState,
  save,
  load,
  action,
  publicState,
} from "../backend/game.js";
import { fishPage } from "../backend/fish-store.js";
import { fish } from "../backend/genetics.js";
import { inventory } from "../backend/collectibles.js";
import { createApp } from "../backend/server.js";
async function setup(t) {
  const db = await testDatabase();
  t.after(() => db.close());
  for (const id of ["a", "b"])
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(id, id, "x", "x", JSON.stringify(initialState()));
  return db;
}
async function addFish(db, tiers) {
  const s = await load(db, "a");
  s.fish = tiers.flatMap(([n, rarity]) =>
    Array.from({ length: n }, () => fish({ tier: rarity, mature: true })),
  );
  s.storage = 50000;
  s.pearls = 1000000;
  await save(db, "a", s);
  return s;
}
test("fish recycle supports per-tier complete groups and leftover examples, immutable snapshot and lock/breeding/limited safety", async (t) => {
  const db = await setup(t);
  let s = await addFish(db, [
    [8, 0],
    [19, 1],
    [25, 2],
    [109, 3],
  ]);
  const protectedFish = s.fish.find((f) => f.rarity === 3);
  await action(db, "a", "fishLock", { id: protectedFish.id, locked: true });
  let result = await action(db, "a", "fishPreview", {
    operation: "recycle",
    tiers: [0, 1, 2, 3],
  });
  assert.deepEqual(
    result.itemPreview.summary.map((g) => [
      g.eligible,
      g.consume,
      g.left,
      g.tickets,
    ]),
    [
      [8, 0, 8, 0],
      [19, 10, 9, 1],
      [25, 20, 5, 2],
      [108, 100, 8, 10],
    ],
  );
  await assert.rejects(
    action(db, "b", "fishCommit", {
      previewId: result.itemPreview.id,
      confirm: true,
    }),
  );
  await action(db, "a", "fishCommit", {
    previewId: result.itemPreview.id,
    confirm: true,
  });
  s = await load(db, "a");
  assert.equal(s.fish.length, 31);
  assert.equal(
    s.items.reduce((n, i) => n + i.count, 0),
    13,
  );
  assert.ok(s.fish.some((f) => f.id === protectedFish.id));
  result = await action(db, "a", "fishPreview", { operation: "delete" });
  const change = s.fish.find((f) => !f.locked);
  await action(db, "a", "fishLock", { id: change.id, locked: true });
  await assert.rejects(
    action(db, "a", "fishCommit", {
      previewId: result.itemPreview.id,
      confirm: true,
    }),
    /selection_changed/,
  );
  assert.equal((await load(db, "a")).fish.length, 31);
  s = await load(db, "a");
  s.fish[0].limited = "2026-10";
  s.breeds = [
    {
      id: "active",
      parents: [s.fish[1].id, s.fish[2].id],
      children: [],
      claimed: false,
      ready: Date.now() + 99999,
    },
  ];
  await save(db, "a", s);
  const selected = await action(db, "a", "fishPreview", {
    operation: "delete",
  });
  await action(db, "a", "fishCommit", {
    previewId: selected.itemPreview.id,
    confirm: true,
  });
  const remaining = await load(db, "a");
  assert.ok(remaining.fish.some((f) => f.id === s.fish[0].id));
  assert.ok(remaining.fish.some((f) => f.id === s.fish[1].id));
  assert.ok(remaining.fish.some((f) => f.id === s.fish[2].id));
});
test(
  "50,000 fish are indexed and paginated; upgrades stop at cap, heartbeat stays bounded, cross-page recycle preserves lineage",
  { timeout: 120000 },
  async (t) => {
    const db = await setup(t);
    await addFish(db, [[50000, 2]]);
    let s = await publicState(db, "a");
    assert.equal(s.fishCounts.storage, 50000);
    assert.equal(s.fish.length, 240);
    const page = await fishPage(db, "a", { page: 1042, tiers: [2] });
    assert.equal(page.total, 50000);
    assert.equal(page.rows.length, 32);
    assert.equal(page.eligibleTotal, 50000);
    assert.equal(
      (await fishPage(db, "a", { search: "no_such_species" })).total,
      0,
    );
    await assert.rejects(
      action(db, "a", "gacha", { count: 1 }),
      /Storage full/,
    );
    await assert.rejects(
      action(db, "a", "upgrade", { kind: "storage" }),
      /Maximum storage/,
    );
    s = await action(db, "a", "heartbeat");
    assert.equal(s.fish.length, 240);
    const raw = JSON.parse(
      (await db.prepare("SELECT state FROM users WHERE id=?").get("a")).state,
    );
    assert.equal(raw.fish, undefined);
    assert.equal(raw.fishRows, true);
    s = await action(db, "a", "fishPreview", {
      operation: "recycle",
      tiers: [2],
    });
    assert.equal(s.itemPreview.total, 50000);
    await action(db, "a", "fishCommit", {
      previewId: s.itemPreview.id,
      confirm: true,
    });
    s = await publicState(db, "a");
    assert.equal(s.fishCounts.total, 0);
    assert.equal(
      s.items.reduce((n, i) => n + i.count, 0),
      5000,
    );
    assert.equal(
      Number((await db.prepare("SELECT count(*) n FROM lineage").get()).n),
      50000,
    );
  },
);
test("storage progression charges original price and caps final paid upgrade at 50,000", async (t) => {
  const db = await setup(t);
  const s = await load(db, "a");
  s.storage = 49960;
  s.pearls = 1000000;
  await save(db, "a", s);
  const upgraded = await action(db, "a", "upgrade", { kind: "storage" });
  assert.equal(upgraded.storage, 50000);
  assert.equal(upgraded.pearls, 900080);
});
test("all-category recycle is one transaction and rejects changed snapshot identities", async (t) => {
  const db = await setup(t);
  await addFish(db, [[20, 1]]);
  for (const category of ["decoration", "background", "accessory"])
    await action(db, "a", "itemGacha", { category, count: 100 });
  const before = (await load(db, "a")).fish.length;
  let s = await action(db, "a", "recycleAllPreview", {
    tiers: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.equal(s.bulkPreviews.length, 4);
  await assert.rejects(
    action(db, "a", "recycleAllCommit", {
      confirm: true,
      previewIds: ["wrong"],
    }),
  );
  assert.equal((await load(db, "a")).fish.length, before);
  const item = await db
    .prepare(
      "SELECT i.id FROM collectible_instances i JOIN inventory_preview_rows r ON r.instance_id=i.id WHERE r.preview_id=? LIMIT 1",
    )
    .get(s.bulkPreviews.find((v) => v.category === "background").id);
  await action(db, "a", "itemLock", { id: item.id, locked: true });
  await assert.rejects(
    action(db, "a", "recycleAllCommit", {
      confirm: true,
      previewIds: s.bulkPreviews.map((v) => v.id),
    }),
  );
  assert.equal((await load(db, "a")).fish.length, before);
  s = await action(db, "a", "recycleAllPreview", {
    tiers: [0, 1, 2, 3, 4, 5, 6],
  });
  await action(db, "a", "recycleAllCommit", {
    confirm: true,
    previewIds: s.bulkPreviews.map((v) => v.id),
  });
  assert.equal((await load(db, "a")).fish.length, 0);
});
test("stack quantities, locked supplies, fish bulk opening and all-category tickets share atomic previews", async (t) => {
  const db = await setup(t);
  const s = await load(db, "a");
  s.storage = 50000;
  s.items = [
    { id: "tickets", type: "ticket", count: 25, rarity: 2 },
    { id: "food", type: "food", count: 37, locked: true },
  ];
  await save(db, "a", s);
  let result = await action(db, "a", "stackPreview", {
    operation: "open",
    quantities: [{ key: "tickets", quantity: 10 }],
  });
  await action(db, "a", "stackCommit", {
    previewId: result.stackPreview.id,
    confirm: true,
  });
  let current = await load(db, "a");
  assert.equal(current.items.find((i) => i.id === "tickets").count, 15);
  assert.equal(current.fish.length, 15);
  assert.ok(current.fish.slice(5).every((f) => f.rarity >= 2));
  result = await action(db, "a", "stackPreview", {
    operation: "delete",
    category: "food",
  });
  assert.equal(result.stackPreview.total, 0);
  await db
    .prepare(
      "INSERT INTO collectible_tickets(user_id,category,rarity,quantity) VALUES(?,?,?,?)",
    )
    .run("a", "background", 6, 25);
  result = await action(db, "a", "stackPreview", {
    operation: "open",
    quantities: [{ key: "background:6", quantity: 12 }],
  });
  await action(db, "a", "stackCommit", {
    previewId: result.stackPreview.id,
    confirm: true,
  });
  assert.equal(
    (await inventory(db, "a", { category: "background" })).total,
    12,
  );
  result = await action(db, "a", "stackPreview", {
    operation: "delete",
    quantities: [{ key: "background:6", quantity: 3 }],
  });
  await action(db, "a", "stackCommit", {
    previewId: result.stackPreview.id,
    confirm: true,
  });
  assert.equal(
    (await inventory(db, "a", { category: "background" })).tickets[0].quantity,
    10,
  );
  await assert.rejects(
    action(db, "a", "stackPreview", {
      operation: "delete",
      quantities: [{ key: "food", quantity: 1 }],
    }),
  );
});
test("item HTTP actions share durable replay protection and concurrent spending; inventory endpoints require authentication", async (t) => {
  const db = await testDatabase(),
    app = await createApp({ db, production: true }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const registration = await fetch(base + "auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "exp_" + Date.now(),
      password: "expansion-password",
    }),
  });
  const cookie = registration.headers.get("set-cookie").split(";")[0];
  await registration.json();
  const send = (key) =>
    fetch(base + "action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        type: "itemGacha",
        payload: { category: "decoration", count: 10 },
      }),
    });
  const duplicate = await Promise.all([
    send("identical-item-request"),
    send("identical-item-request"),
  ]);
  assert.ok(duplicate.every((r) => r.ok));
  const same = await Promise.all(duplicate.map((r) => r.json()));
  assert.equal(same[0].pearls, 2100);
  assert.equal(same[1].pearls, 2100);
  const simultaneous = await Promise.all([
    send("separate-1"),
    send("separate-2"),
  ]);
  assert.ok(simultaneous.every((r) => r.ok));
  await Promise.all(simultaneous.map((r) => r.json()));
  const inv = await (
    await fetch(base + "items?category=decoration", {
      headers: { Cookie: cookie },
    })
  ).json();
  assert.equal(inv.total, 30);
  const denied = await send("cannot-spend-again");
  assert.equal(denied.status, 400);
  for (const path of ["items?category=decoration", "fish", "stacks"])
    assert.equal((await fetch(base + path)).status, 401);
});
