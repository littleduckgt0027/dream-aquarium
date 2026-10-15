import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDB, transaction } from "../backend/db.js";
import { load, save, ledger } from "../backend/game.js";

export const TARGET = "TaYuak";
export const BALANCE = 1_000_000_000;
export const OPERATION = "admin-set-balance-TaYuak-1000000000-v1";
const CONFIRM = `${TARGET}:${BALANCE}`;

// No HTTP route, import from the server, startup hook or default grant uses this.
// Reuse the game's economy lock BEFORE reading, then explicitly lock the user.
export async function setTestBalance(
  db,
  { username, balance, dryRun = true, confirm } = {},
) {
  if (username !== TARGET || balance !== BALANCE)
    throw Error(
      "This one-time command only targets exact username TaYuak and balance 1000000000",
    );
  if (!dryRun && confirm !== CONFIRM)
    throw Error("Explicit confirmation required: --confirm TaYuak:1000000000");
  const result = await transaction(db, async () => {
    const rows = await db
      .prepare(
        "SELECT id,username FROM users WHERE username=?" +
          (db.dialect === "postgres" ? " FOR UPDATE" : ""),
      )
      .all(username);
    if (rows.length !== 1)
      throw Error(
        "Exactly one account named TaYuak is required; nothing changed",
      );
    const user = rows[0],
      state = await load(db, user.id);
    const old = await db
      .prepare("SELECT body,result FROM requests WHERE user_id=? AND key=?")
      .get(user.id, OPERATION);
    const body = JSON.stringify({
      command: "admin-set-balance",
      username,
      balance,
    });
    if (old && old.body !== body)
      throw Error("Operation record conflicts; nothing changed");
    const report = {
      username: user.username,
      id: user.id,
      previousBalance: state.pearls,
      targetBalance: balance,
      dryRun,
      alreadyApplied: !!old,
    };
    if (dryRun || old) return report;
    const delta = balance - state.pearls;
    if (!Number.isSafeInteger(state.pearls) || !Number.isSafeInteger(delta))
      throw Error("Invalid current balance; nothing changed");
    const now = Date.now();
    ledger(state, delta, "Owner-authorized test balance adjustment", now);
    await save(db, user.id, state);
    await db
      .prepare("INSERT INTO audit(time,user_id,action,detail) VALUES(?,?,?,?)")
      .run(
        now,
        user.id,
        "admin_set_balance",
        JSON.stringify({
          operation: OPERATION,
          previous: report.previousBalance,
          balance,
          delta,
          requestId: randomUUID(),
        }),
      );
    await db
      .prepare("INSERT INTO requests VALUES(?,?,?,?)")
      .run(
        user.id,
        OPERATION,
        body,
        JSON.stringify({ balance, delta, time: now }),
      );
    return report;
  });
  // Separate committed read: if gameplay spent money immediately after COMMIT,
  // report that current value; do not replay a previously applied top-up.
  result.verifiedBalance = (await load(db, result.id)).pearls;
  if (!dryRun && !result.alreadyApplied && result.verifiedBalance !== balance)
    throw Error(
      "Adjustment committed, but balance changed before verification. Inspect audit; retry will not reapply it",
    );
  return result;
}

export function parseArgs(args) {
  const options = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (
      !["--username", "--balance", "--confirm"].includes(flag) ||
      i + 1 >= args.length ||
      args[i + 1].startsWith("--")
    )
      throw Error(
        "Usage: node scripts/admin-set-balance.js --username TaYuak --balance 1000000000 --dry-run | --confirm TaYuak:1000000000",
      );
    const key = flag.slice(2);
    if (options[key] !== undefined) throw Error("Duplicate option");
    options[key] = key === "balance" ? Number(args[++i]) : args[++i];
  }
  return options;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let db;
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.dryRun && options.confirm !== CONFIRM)
      throw Error(
        "Review --dry-run first; execution requires --confirm TaYuak:1000000000",
      );
    if (!process.env.DATABASE_URL)
      throw Error(
        "DATABASE_URL must be configured privately; this CLI does not fall back to SQLite",
      );
    db = await openDB();
    const report = await setTestBalance(db, options);
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    // Never print driver errors/details which might contain credentials or state.
    console.error(
      e.code
        ? "Database operation failed; no credentials printed. Inspect the audit before retrying."
        : e.message,
    );
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
