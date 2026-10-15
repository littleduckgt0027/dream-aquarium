import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database.js";
import { initialState, action, load, save } from "../backend/game.js";
import { inventory } from "../backend/collectibles.js";
import {
  CATALOG,
  CATEGORIES,
  ODDS,
  ITEM_ROLLS,
} from "../shared/collectibles.js";
async function setup(t) {
  const db = await testDatabase();
  t.after(() => db.close());
  for (const id of ["a", "b"]) {
    const s = initialState();
    s.pearls = 1000000;
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(id, id, "x", "x", JSON.stringify(s));
  }
  return db;
}
async function seed(db, n = 25, r = 0) {
  for (let i = 0; i < n; i++)
    await db
      .prepare(
        "INSERT INTO collectible_instances(id,user_id,definition_id,category,rarity,created) VALUES(?,?,?,?,?,?)",
      )
      .run(randomUUID(), "a", CATALOG[r * 2].id, "decoration", r, Date.now());
}
test("catalog uses unchanged authoritative fish odds, 2 real designs per category/tier and existing economy prices", () => {
  assert.deepEqual(ODDS, [60, 25, 10, 3.8, 1, 0.18, 0.02]);
  assert.deepEqual(ITEM_ROLLS, { 1: 100, 10: 900, 100: 8500 });
  assert.equal(CATALOG.length, 42);
  assert.equal(new Set(CATALOG.map((d) => d.id)).size, 42);
  for (const c of CATEGORIES)
    for (let r = 0; r < 7; r++)
      assert.equal(
        CATALOG.filter((d) => d.category === c && d.rarity === r).length,
        2,
      );
});
test("gacha x1/x10/x100 spends atomically, validates category/count and ownership inventory", async (t) => {
  const db = await setup(t);
  let spent = 0;
  for (const category of CATEGORIES)
    for (const count of [1, 10, 100]) {
      const s = await action(db, "a", "itemGacha", { category, count });
      spent += ITEM_ROLLS[count];
      assert.equal(s.pearls, 1000000 - spent);
      assert.equal(s.lastItemRoll.length, count);
      assert.ok(s.lastItemRoll.every((i) => i.rarity >= 0 && i.rarity <= 6));
    }
  assert.equal(
    (await inventory(db, "a", { category: "decoration" })).total,
    111,
  );
  assert.equal((await inventory(db, "b", { category: "decoration" })).total, 0);
  await assert.rejects(
    action(db, "a", "itemGacha", { category: "fish", count: 1 }),
  );
  await assert.rejects(
    action(db, "a", "itemGacha", { category: "decoration", count: "10" }),
  );
  const s = await load(db, "a");
  s.pearls = 0;
  await save(db, "a", s);
  await assert.rejects(
    action(db, "a", "itemGacha", { category: "decoration", count: 1 }),
  );
  assert.equal(
    (await inventory(db, "a", { category: "decoration" })).total,
    111,
  );
});
test("snapshot recycling computes groups per tier, leaves leftovers, excludes placed/locked and rejects races", async (t) => {
  const db = await setup(t);
  await seed(db, 37);
  await seed(db, 19, 1);
  let inv = await inventory(db, "a", { category: "decoration" });
  const item = inv.rows[0];
  await action(db, "a", "itemPlace", {
    id: item.id,
    x: 0.5,
    y: 0.8,
    scale: 1,
    rotation: 30,
  });
  inv = await inventory(db, "a", { category: "decoration" });
  const locked = inv.rows.find((i) => i.id !== item.id);
  await action(db, "a", "itemLock", { id: locked.id, locked: true });
  let s = await action(db, "a", "itemPreview", {
    category: "decoration",
    operation: "recycle",
  });
  assert.equal(s.itemPreview.total, 40);
  const previewId = s.itemPreview.id;
  await action(db, "a", "itemCommit", { previewId, confirm: true });
  inv = await inventory(db, "a", { category: "decoration" });
  assert.equal(inv.total, 16);
  assert.equal(
    Number(
      (
        await db
          .prepare(
            "SELECT count(*) n FROM inventory_consumptions WHERE preview_id=?",
          )
          .get(previewId)
      ).n,
    ),
    40,
  );
  assert.equal(
    inv.tickets.reduce((n, t) => n + t.quantity, 0),
    4,
  );
  await assert.rejects(
    action(db, "a", "itemCommit", { previewId, confirm: true }),
  );
  await assert.rejects(
    action(db, "b", "itemCommit", { previewId, confirm: true }),
  );
  await seed(db, 10);
  s = await action(db, "a", "itemPreview", {
    category: "decoration",
    operation: "delete",
  });
  const first = (
    await inventory(db, "a", { category: "decoration" })
  ).rows.find((i) => i.locked === 0 && i.x === null);
  await action(db, "a", "itemLock", { id: first.id, locked: true });
  await assert.rejects(
    action(db, "a", "itemCommit", {
      previewId: s.itemPreview.id,
      confirm: true,
    }),
    /selection_changed/,
  );
});
test("all ticket categories preserve minimum tier and bulk counts; background and accessories persist uniquely", async (t) => {
  const db = await setup(t);
  for (const category of CATEGORIES) {
    await db
      .prepare(
        "INSERT INTO collectible_tickets(user_id,category,rarity,quantity) VALUES(?,?,?,?)",
      )
      .run("a", category, 5, 10);
    let s = await action(db, "a", "itemTicket", {
      category,
      rarity: 5,
      count: 10,
    });
    assert.equal(s.lastItemRoll.length, 10);
    assert.ok(s.lastItemRoll.every((i) => i.rarity >= 5));
    await assert.rejects(
      action(db, "a", "itemTicket", { category, rarity: 5, count: 1 }),
    );
  }
  const bg = (await inventory(db, "a", { category: "background" })).rows;
  await action(db, "a", "itemEquip", { id: bg[0].id });
  let s = await action(db, "a", "itemEquip", { id: bg[1].id });
  assert.equal(s.cosmetics.background.id, bg[1].id);
  const acc = (await inventory(db, "a", { category: "accessory" })).rows[0];
  await action(db, "a", "itemEquip", { id: acc.id, fishId: s.fish[0].id });
  s = await action(db, "a", "itemEquip", { id: acc.id, fishId: s.fish[1].id });
  assert.equal(s.cosmetics.accessories.length, 1);
  assert.equal(s.cosmetics.accessories[0].fish_id, s.fish[1].id);
  await assert.rejects(
    action(db, "b", "itemEquip", { id: acc.id, fishId: s.fish[0].id }),
  );
  await assert.rejects(
    action(db, "a", "itemPlace", {
      id: bg[0].id,
      x: 0.5,
      y: 0.5,
      rotation: 0,
      scale: 1,
    }),
  );
  const preview = await action(db, "a", "itemPreview", {
    category: "accessory",
    operation: "delete",
  });
  await action(db, "a", "itemCommit", {
    previewId: preview.itemPreview.id,
    confirm: true,
  });
  assert.equal((await inventory(db, "a", { category: "accessory" })).total, 1);
});

test(
  "50,000 item capacity is enforced before spending or consuming tickets; paged bulk recycle has no one-group limit",
  { timeout: 120000 },
  async (t) => {
    const db = await setup(t);
    for (let at = 0; at < 50000; at += 100) {
      const rows = Array.from({ length: 100 }, (_, i) => [
        `cap-${at + i}`,
        "a",
        "background_lagoon",
        "background",
        0,
        at + i,
      ]);
      await db
        .prepare(
          "INSERT INTO collectible_instances(id,user_id,definition_id,category,rarity,created) VALUES " +
            rows.map(() => "(?,?,?,?,?,?)").join(","),
        )
        .run(...rows.flat());
    }
    const inv = await inventory(db, "a", {
      category: "background",
      page: 1042,
    });
    assert.equal(inv.rows.length, 32);
    assert.equal(inv.total, 50000);
    assert.equal(inv.eligibleTotal, 50000);
    await assert.rejects(
      action(db, "a", "itemGacha", { category: "background", count: 1 }),
      /capacity/,
    );
    assert.equal((await load(db, "a")).pearls, 1000000);
    await db
      .prepare(
        "INSERT INTO collectible_tickets(user_id,category,rarity,quantity) VALUES(?,?,?,?)",
      )
      .run("a", "background", 0, 1);
    await assert.rejects(
      action(db, "a", "itemTicket", {
        category: "background",
        rarity: 0,
        count: 1,
      }),
      /capacity/,
    );
    assert.equal(
      (await inventory(db, "a", { category: "background" })).tickets[0]
        .quantity,
      1,
    );
    const s = await action(db, "a", "itemPreview", {
      category: "background",
      operation: "recycle",
    });
    assert.equal(s.itemPreview.total, 50000);
    await action(db, "a", "itemCommit", {
      previewId: s.itemPreview.id,
      confirm: true,
    });
    assert.equal(
      (await inventory(db, "a", { category: "background" })).tickets[0]
        .quantity,
      5001,
    );
  },
);
