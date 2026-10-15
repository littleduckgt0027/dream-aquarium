import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDB, transaction } from "../backend/db.js";
import {
  initialState,
  load,
  save,
  action,
  settle,
  setMaintenance,
  heartbeat,
  publicState,
} from "../backend/game.js";
import { fish, dna, growth, historicalMonths } from "../backend/genetics.js";
import { MARKET_UPGRADES, ODDS, monthKey } from "../shared/rules.js";
const now = Date.UTC(2026, 9, 15, 12);
function setup() {
  const db = openDB(":memory:");
  for (const id of ["a", "b", "c"])
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      id,
      id,
      "x",
      "x",
      JSON.stringify(initialState(now)),
    );
  return db;
}
const run = (db, id, type, p = {}, at = now) =>
  transaction(db, () => action(db, id, type, p, at));
test("rules retain confirmed probabilities and expansion total", () => {
  assert.equal(
    MARKET_UPGRADES.reduce((a, b) => a + b, 0),
    796000,
  );
  assert.ok(Math.abs(ODDS.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.equal(monthKey(Date.UTC(2026, 8, 30, 17)), "2026-10");
});
test("genetics produce complete unique fish and authoritative DNA growth", () => {
  const fs = Array.from({ length: 1000 }, () => fish({ now }));
  assert.equal(new Set(fs.map((f) => f.id)).size, 1000);
  assert.ok(new Set(fs.map((f) => JSON.stringify(f.dna))).size > 990);
  for (const f of fs) {
    assert.equal(growth(f, now), 0);
    assert.equal(growth(f, now + 172800000), 1);
    assert.ok(f.rarity >= 0 && f.rarity < 7);
  }
  assert.equal(historicalMonths(now).length, 9);
});
test("gacha atomically spends and rejects insufficient funds and space", () => {
  const db = setup();
  const a = run(db, "a", "gacha", { count: 10 });
  assert.equal(a.pearls, 2100);
  assert.equal(a.fish.length, 15);
  assert.throws(() => run(db, "a", "gacha", { count: 1000 }));
  assert.equal(load(db, "a").pearls, 2100);
  assert.throws(() => run(db, "a", "gacha", { count: 2 }));
});
test("large gacha batch delivers 1000 unique fish efficiently", () => {
  const db = setup(),
    s = load(db, "a");
  s.pearls = 100000;
  s.storage = 1200;
  save(db, "a", s);
  const a = run(db, "a", "gacha", { count: 1000 });
  assert.equal(a.pearls, 20000);
  assert.equal(a.lastRoll.length, 1000);
  assert.equal(new Set(a.lastRoll).size, 1000);
});
test("ownership, capacity and confirmation checks protect fish", () => {
  const db = setup();
  const a = load(db, "a"),
    id = a.fish[0].id;
  assert.throws(() => run(db, "b", "move", { id, location: "storage" }));
  assert.throws(() => run(db, "a", "release", { id }));
  run(db, "a", "move", { id, location: "storage" });
  assert.equal(load(db, "a").fish[0].location, "storage");
  run(db, "a", "release", { id, confirm: true });
  assert.equal(load(db, "a").fish.length, 4);
});
test("breeding has inheritance, timers, genealogy and no duplicate claiming", () => {
  const db = setup(),
    a = load(db, "a");
  const ids = a.fish.slice(0, 2).map((f) => f.id);
  let s = run(db, "a", "breed", { a: ids[0], b: ids[1] });
  const j = s.breeds[0];
  assert.equal(s.pearls, 2800);
  assert.throws(() => run(db, "a", "breedClaim", { id: j.id }));
  assert.throws(() => run(db, "a", "release", { id: ids[0], confirm: true }));
  assert.throws(() => run(db, "a", "breed", { a: ids[0], b: ids[1] }));
  s = run(db, "a", "breedClaim", { id: j.id }, now + 120001);
  assert.equal(s.fish.length, 5 + j.children.length);
  assert.deepEqual(j.children[0].parents, ids);
  assert.equal(j.children[0].generation, 1);
  assert.ok(
    [a.fish[0].dna.body, a.fish[1].dna.body].includes(j.children[0].dna.body),
  );
  assert.throws(() => run(db, "a", "breedClaim", { id: j.id }, now + 120002));
});
test("10 distinct equal-rarity fish recycle into one non-tradable single-use ticket", () => {
  const db = setup(),
    s = load(db, "a");
  s.fish = Array.from({ length: 10 }, () => fish({ tier: 2, now }));
  save(db, "a", s);
  const ids = s.fish.map((f) => f.id);
  assert.throws(() => run(db, "a", "recycle", { ids: Array(10).fill(ids[0]) }));
  let a = run(db, "a", "recycle", { ids });
  assert.equal(a.fish.length, 0);
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].tradable, false);
  const ticket = a.items[0].id;
  a = run(db, "a", "ticket", { id: ticket });
  assert.ok(a.fish[0].rarity >= 2);
  assert.throws(() => run(db, "a", "ticket", { id: ticket }));
});
test("buy now transfers exactly once with correct 10% tax and delivery", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", { id: s.fish[0].id, type: "fixed", price: 1000 });
  const l = publicState(db, "a", now).listings[0];
  assert.equal(load(db, "a").fish.length, 4);
  run(db, "b", "buy", { id: l.id });
  assert.equal(load(db, "a").pearls, 3900);
  assert.equal(load(db, "b").pearls, 2000);
  assert.equal(load(db, "b").deliveries.length, 1);
  assert.throws(() => run(db, "c", "buy", { id: l.id }));
  assert.equal(load(db, "c").pearls, 3000);
  const d = load(db, "b").deliveries[0];
  run(db, "b", "delivery", { id: d.id });
  assert.equal(load(db, "b").fish.length, 6);
  assert.throws(() => run(db, "b", "delivery", { id: d.id }));
});
test("auction bids escrow, refund, prevent invalid bids, and settle once", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", {
    id: s.fish[0].id,
    type: "auction",
    price: 100,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  assert.throws(() => run(db, "a", "bid", { id: l.id, amount: 100 }));
  run(db, "b", "bid", { id: l.id, amount: 200 });
  assert.equal(load(db, "b").pearls, 2800);
  assert.throws(() => run(db, "a", "cancel", { id: l.id }));
  assert.throws(() => run(db, "c", "bid", { id: l.id, amount: 199 }));
  run(db, "c", "bid", { id: l.id, amount: 300 });
  assert.equal(load(db, "b").pearls, 3000);
  transaction(db, () => settle(db, now + 6 * 3600000 + 1));
  assert.equal(load(db, "a").pearls, 3270);
  assert.equal(load(db, "c").deliveries.length, 1);
  transaction(db, () => settle(db, now + 6 * 3600000 + 2));
  assert.equal(load(db, "c").deliveries.length, 1);
});
test("auction buyout refunds existing bidder and cancellation returns escrow fish", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", {
    id: s.fish[0].id,
    type: "auction",
    price: 100,
    buyout: 1000,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  run(db, "b", "bid", { id: l.id, amount: 200 });
  run(db, "c", "buy", { id: l.id });
  assert.equal(load(db, "b").pearls, 3000);
  assert.equal(load(db, "c").pearls, 2000);
  run(db, "a", "list", { id: s.fish[1].id, type: "fixed", price: 100 });
  const l2 = publicState(db, "a", now).listings[0];
  run(db, "a", "cancel", { id: l2.id });
  assert.equal(load(db, "a").deliveries.length, 1);
});
test("online time excludes gaps, hidden/offline time and duplicate heartbeat", () => {
  const s = initialState(now);
  heartbeat(s, now);
  heartbeat(s, now + 15000);
  assert.equal(s.online.seconds, 15);
  heartbeat(s, now + 15000);
  assert.equal(s.online.seconds, 15);
  heartbeat(s, now + 600000);
  assert.equal(s.online.seconds, 15);
  s.online.total = 10799;
  s.online.last = now + 600000;
  heartbeat(s, now + 601000);
  assert.equal(s.rewards.length, 1);
  heartbeat(s, now + 601000);
  assert.equal(s.rewards.length, 1);
});
test("monthly rollover retains rewards; Claim All does not bypass selections", () => {
  const db = setup(),
    s = load(db, "a");
  s.online.seconds = 86400;
  s.online.last = now;
  save(db, "a", s);
  let a = run(db, "a", "heartbeat", {}, now + 15000);
  assert.equal(a.rewards.filter((r) => r.kind === "limited").length, 1);
  assert.throws(() => run(db, "a", "reward", { all: true }));
  const r = a.rewards[0];
  assert.throws(() => run(db, "a", "reward", { id: r.id }));
  a = run(db, "a", "reward", { id: r.id, selection: "moonlight" });
  assert.equal(a.deliveries.length, 1);
  assert.equal(a.collection.length, 1);
  assert.throws(() =>
    run(db, "a", "reward", { id: r.id, selection: "moonlight" }),
  );
  a = run(db, "a", "heartbeat", {}, Date.UTC(2026, 10, 1));
  assert.equal(a.online.seconds, 0);
  assert.equal(a.rewards.length, 1);
});
test("maintenance pauses auctions and resets observed online interval", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", {
    id: s.fish[0].id,
    type: "auction",
    price: 100,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  transaction(db, () => setMaintenance(db, true, now + 10000));
  assert.equal(load(db, "a").online.last, 0);
  transaction(db, () => setMaintenance(db, false, now + 3700000));
  assert.equal(
    publicState(db, "a", now).listings[0].end_at,
    l.end_at + 3690000,
  );
});
test("rollback preserves balance and escrow on a failed transaction", () => {
  const db = setup(),
    s = load(db, "a");
  assert.throws(() =>
    transaction(db, () => {
      action(db, "a", "gacha", { count: 10 }, now);
      throw Error("abort");
    }),
  );
  assert.equal(load(db, "a").pearls, s.pearls);
  assert.equal(load(db, "a").fish.length, s.fish.length);
});
test("highest bidder can apply escrow to own buyout; lineage survives release", () => {
  const db = setup(),
    s = load(db, "a");
  save(db, "a", s);
  const f = s.fish[0];
  run(db, "a", "list", {
    id: f.id,
    type: "auction",
    price: 100,
    buyout: 2900,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  run(db, "b", "bid", { id: l.id, amount: 2000 });
  run(db, "b", "buy", { id: l.id });
  assert.equal(load(db, "b").pearls, 100);
  assert.ok(db.prepare("SELECT fish FROM lineage WHERE id=?").get(f.id));
});
test("invalid amounts, types and immature parents cannot mutate economy", () => {
  const db = setup();
  for (const price of [-1, 0, 0.5, NaN, Infinity, 1000000001])
    assert.throws(() =>
      run(db, "a", "list", {
        id: load(db, "a").fish[0].id,
        type: "fixed",
        price,
      }),
    );
  assert.throws(() => run(db, "a", "gacha", { count: "10" }));
  assert.equal(load(db, "a").pearls, 3000);
  const s = load(db, "a");
  s.fish[0].born = now;
  save(db, "a", s);
  assert.throws(() =>
    run(db, "a", "breed", { a: s.fish[0].id, b: s.fish[1].id }),
  );
});
test("raising own bid uses existing escrow without requiring a second full balance", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", {
    id: s.fish[0].id,
    type: "auction",
    price: 100,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  run(db, "b", "bid", { id: l.id, amount: 2500 });
  run(db, "b", "bid", { id: l.id, amount: 2600 });
  assert.equal(load(db, "b").pearls, 400);
  assert.throws(() => run(db, "b", "bid", { id: l.id, amount: 3001 }));
  assert.equal(load(db, "b").pearls, 400);
});
test("maintenance first settles auctions that already ended and exposes freeze timestamp", () => {
  const db = setup(),
    s = load(db, "a");
  run(db, "a", "list", {
    id: s.fish[0].id,
    type: "auction",
    price: 100,
    hours: 6,
  });
  const l = publicState(db, "a", now).listings[0];
  run(db, "b", "bid", { id: l.id, amount: 200 });
  transaction(db, () => setMaintenance(db, true, now + 7 * 3600000));
  assert.equal(load(db, "b").deliveries.length, 1);
  assert.equal(publicState(db, "a", now).maintenanceSince, now + 7 * 3600000);
});
