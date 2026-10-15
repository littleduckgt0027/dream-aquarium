import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDB, transaction } from "../backend/db.js";
import { initialState, action, load, save } from "../backend/game.js";
test("database migrations repeat; fish, DNA and ledger survive restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aquarium-db-"));
  const file = join(dir, "game.sqlite");
  try {
    let db = await openDB(file);
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(
        "persist",
        "persist",
        "hash",
        "hash",
        JSON.stringify(initialState()),
      );
    await transaction(
      db,
      async () => await action(db, "persist", "gacha", { count: 1 }),
    );
    const before = await load(db, "persist");
    await db.close();
    db = await openDB(file);
    const after = await load(db, "persist");
    assert.deepEqual(after, before);
    assert.equal(after.pearls, 2900);
    assert.equal(
      (await db.prepare("PRAGMA integrity_check").get()).integrity_check,
      "ok",
    );
    await db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
