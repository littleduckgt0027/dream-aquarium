import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDB, transaction } from "../backend/db.js";
import { initialState, action, load, save } from "../backend/game.js";
test("database migrations repeat; fish, DNA and ledger survive restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "aquarium-db-"));
  const file = join(dir, "game.sqlite");
  try {
    let db = openDB(file);
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      "persist",
      "persist",
      "hash",
      "hash",
      JSON.stringify(initialState()),
    );
    transaction(db, () => action(db, "persist", "gacha", { count: 1 }));
    const before = load(db, "persist");
    db.close();
    db = openDB(file);
    const after = load(db, "persist");
    assert.deepEqual(after, before);
    assert.equal(after.pearls, 2900);
    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
