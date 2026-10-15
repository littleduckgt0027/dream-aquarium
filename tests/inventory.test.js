import test from "node:test";
import assert from "node:assert/strict";
import { addStack, consume } from "../backend/inventory.js";
import { openDB, transaction } from "../backend/db.js";
import { action, initialState, load, save } from "../backend/game.js";
test("stackable inventory splits at 999 and consumes without duplication", () => {
  const items = [];
  addStack(items, "food", 2000);
  assert.deepEqual(
    items.map((i) => i.count),
    [999, 999, 2],
  );
  addStack(items, "food", 1000);
  assert.deepEqual(
    items.map((i) => i.count),
    [999, 999, 999, 3],
  );
  assert.equal(consume(items, items[3].id).at(-1).count, 2);
  assert.throws(() => addStack(items, "food", -1));
});
test("buying and feeding are atomic, grow only owned young fish and retain true age", () => {
  const db = openDB(":memory:");
  const now = Date.now(),
    s = initialState(now);
  s.fish[0].born = now;
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
    "a",
    "a",
    "x",
    "x",
    JSON.stringify(s),
  );
  const run = (t, p) => transaction(db, () => action(db, "a", t, p, now));
  let a = run("buyFood", { count: 2 });
  assert.equal(a.pearls, 2960);
  const item = a.items[0].id;
  assert.throws(() => run("feed", { id: item, fishId: "someone-elses-fish" }));
  a = run("feed", { id: item, fishId: a.fish[0].id });
  assert.ok(a.fish[0].growth > 0);
  assert.equal(a.fish[0].born, now);
  assert.equal(a.items[0].count, 1);
  assert.throws(() => run("feed", { id: item, fishId: a.fish[1].id }));
  assert.equal(load(db, "a").items[0].count, 1);
  db.close();
});
