import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDB } from "../backend/db.js";
import { initialState } from "../backend/game.js";
import { verifiedCopy } from "../scripts/backup.js";
test("live WAL backup and restore preserve accounts and refuse overwrite", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aquarium-backup-"));
  const db = openDB(join(dir, "live.sqlite"));
  try {
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      "saved",
      "saved",
      "hash",
      "hash",
      JSON.stringify(initialState()),
    );
    await verifiedCopy(join(dir, "live.sqlite"), join(dir, "backup.sqlite"));
    await verifiedCopy(
      join(dir, "backup.sqlite"),
      join(dir, "restored.sqlite"),
    );
    const restored = openDB(join(dir, "restored.sqlite"));
    assert.equal(restored.prepare("SELECT count(*) n FROM users").get().n, 1);
    restored.close();
    await assert.rejects(
      () => verifiedCopy(join(dir, "live.sqlite"), join(dir, "backup.sqlite")),
      /already exists/,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
