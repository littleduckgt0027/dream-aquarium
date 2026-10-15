import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openPostgres, transaction } from "../backend/db.js";

const tables = {
  users: ["id", "username", "password", "recovery", "state"],
  sessions: ["token", "user_id", "expires"],
  listings: [
    "id",
    "seller",
    "fish",
    "type",
    "price",
    "buyout",
    "end_at",
    "bid",
    "bidder",
    "status",
    "rowid",
  ],
  requests: ["user_id", "key", "body", "result"],
  lineage: ["id", "fish"],
  audit: ["id", "time", "user_id", "action", "detail"],
  meta: ["key", "value"],
  collectible_instances: [
    "id",
    "user_id",
    "definition_id",
    "category",
    "rarity",
    "locked",
    "version",
    "fish_id",
    "slot",
    "equipped",
    "x",
    "y",
    "rotation",
    "scale",
    "created",
  ],
  collectible_tickets: ["user_id", "category", "rarity", "locked", "quantity"],
  player_fish: [
    "id",
    "user_id",
    "rarity",
    "name",
    "generation",
    "location",
    "limited",
    "locked",
    "born",
    "mature_at",
    "ordinal",
    "breeding",
    "data",
  ],
  inventory_previews: [
    "id",
    "user_id",
    "operation",
    "category",
    "created",
    "consumed",
    "summary",
  ],
  inventory_consumptions: ["preview_id", "instance_id", "user_id", "category"],
  inventory_preview_rows: [
    "preview_id",
    "instance_id",
    "version",
    "fingerprint",
  ],
};

// Explicit operator command only. The source is opened read-only and a consistent
// SQLite read transaction includes WAL data. Nothing is deleted or overwritten.
export async function importSQLite(source, db) {
  if (db.dialect !== "postgres")
    throw Error("Import destination must be PostgreSQL");
  const sqlite = new DatabaseSync(source, { readOnly: true });
  try {
    sqlite.exec("BEGIN");
    if (sqlite.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Source integrity check failed");
    if (sqlite.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("Source foreign key check failed");
    const rows = Object.fromEntries(
      Object.keys(tables).map((name) => [
        name,
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          )
          .get(name)
          ? sqlite
              .prepare(`SELECT ${tables[name].join(",")} FROM ${name}`)
              .all()
          : [],
      ]),
    );
    return await transaction(db, async () => {
      // Exclusive destination gate: require a new, empty database. Replays and
      // partial imports cannot silently merge accounts, money or escrow.
      for (const name of Object.keys(tables).filter((n) => n !== "meta")) {
        if ((await db.prepare(`SELECT count(*) n FROM ${name}`).get()).n !== 0)
          throw Error(
            "Import requires an empty destination; no existing data was changed",
          );
      }
      const meta = await db.prepare("SELECT * FROM meta").all();
      if (
        meta.length !== 1 ||
        meta[0].key !== "maintenance" ||
        meta[0].value !== "0"
      )
        throw Error("Destination metadata is not pristine");
      const counts = {};
      for (const [name, columns] of Object.entries(tables)) {
        for (const row of rows[name]) {
          if (name === "meta" && row.key === "maintenance") {
            await db
              .prepare("UPDATE meta SET value=? WHERE key='maintenance'")
              .run(row.value);
          } else {
            await db
              .prepare(
                `INSERT INTO ${name}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
              )
              .run(...columns.map((c) => row[c]));
          }
        }
        counts[name] = rows[name].length;
      }
      // Imported serial IDs must not collide with the next audit/listing.
      await db
        .prepare(
          "SELECT setval(pg_get_serial_sequence('audit','id'), COALESCE(MAX(id),0)+1, false) FROM audit",
        )
        .get();
      await db
        .prepare(
          "SELECT setval(pg_get_serial_sequence('listings','rowid'), COALESCE(MAX(rowid),0)+1, false) FROM listings",
        )
        .get();
      return counts;
    });
  } finally {
    sqlite.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const source = process.argv[2];
  if (!source || !process.env.DATABASE_URL)
    throw Error(
      "Usage: DATABASE_URL=<destination> node scripts/import-sqlite.js SQLITE_BACKUP",
    );
  const db = await openPostgres(process.env.DATABASE_URL);
  try {
    console.log("Import complete:", await importSQLite(source, db));
  } finally {
    await db.close();
  }
}
