import { pathToFileURL } from "node:url";
import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
export async function verifiedCopy(source, destination) {
  if (!existsSync(source)) throw Error("Source database does not exist");
  if (existsSync(destination))
    throw Error(
      "Destination already exists; existing data will not be overwritten",
    );
  mkdirSync(dirname(resolve(destination)), { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, destination);
  } finally {
    db.close();
  }
  const copy = new DatabaseSync(destination, { readOnly: true });
  try {
    if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Backup integrity check failed");
  } finally {
    copy.close();
  }
  if (process.platform !== "win32") chmodSync(destination, 0o600);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.env.DATABASE_URL)
    throw Error(
      "PostgreSQL backups require pg_dump / pg_restore; this command copies local SQLite only",
    );
  const [mode, a, b] = process.argv.slice(2);
  if (mode === "backup" && a)
    await verifiedCopy(process.env.DB_PATH || "data/aquarium.sqlite", a);
  else if (mode === "restore" && a && b) await verifiedCopy(a, b);
  else
    throw Error(
      "Usage: node scripts/backup.js backup NEW_FILE | restore BACKUP_FILE NEW_DATABASE_FILE",
    );
  console.log(
    "Database copy complete; integrity verified. Existing databases were not overwritten.",
  );
}
