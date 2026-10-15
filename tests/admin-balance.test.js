import test from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./helpers/database.js";
import { initialState, load, save, action } from "../backend/game.js";
import {
  setTestBalance,
  parseArgs,
  TARGET,
  BALANCE,
  OPERATION,
} from "../scripts/admin-set-balance.js";
const opts = {
  username: TARGET,
  balance: BALANCE,
  dryRun: false,
  confirm: "TaYuak:1000000000",
};
async function fixture(t) {
  const db = await testDatabase();
  t.after(() => db.close());
  for (const [id, name] of [
    ["target", "TaYuak"],
    ["other", "TaYuak_other"],
  ])
    await db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .run(id, name, "hash", "hash", JSON.stringify(initialState()));
  return db;
}
test("admin balance dry run, exact targeting, confirmation, audit, retry and other-player protection", async (t) => {
  const db = await fixture(t),
    before = await load(db, "target"),
    other = await load(db, "other");
  const dry = await setTestBalance(db, { ...opts, dryRun: true });
  assert.equal(dry.id, "target");
  assert.equal(dry.verifiedBalance, 3000);
  assert.deepEqual(await load(db, "target"), before);
  await assert.rejects(
    setTestBalance(db, { ...opts, username: "tayuak" }),
    /exact username/,
  );
  await assert.rejects(
    setTestBalance(db, { ...opts, confirm: undefined }),
    /confirmation/,
  );
  const done = await setTestBalance(db, opts);
  assert.equal(done.verifiedBalance, BALANCE);
  const after = await load(db, "target");
  const { pearls, ledger, ...rest } = after;
  const { pearls: oldPearls, ledger: oldLedger, ...oldRest } = before;
  assert.deepEqual(rest, oldRest);
  assert.equal(ledger[0].delta, BALANCE - 3000);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM audit WHERE action='admin_set_balance'",
        )
        .get()
    ).n,
    1,
  );
  assert.equal((await setTestBalance(db, opts)).alreadyApplied, true);
  await action(db, "target", "buyFood", { count: 1 });
  assert.equal((await setTestBalance(db, opts)).verifiedBalance, BALANCE - 20);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM audit WHERE action='admin_set_balance'",
        )
        .get()
    ).n,
    1,
  );
  assert.deepEqual(await load(db, "other"), other);
});
test("missing exact account refuses without creating a player", async (t) => {
  const db = await testDatabase();
  t.after(() => db.close());
  await assert.rejects(setTestBalance(db, opts), /Exactly one/);
  assert.equal((await db.prepare("SELECT count(*) n FROM users").get()).n, 0);
});
test("admin failure rolls back wallet, ledger, audit and operation record", async (t) => {
  const db = await fixture(t),
    before = await load(db, "target"),
    prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    if (sql.startsWith("INSERT INTO audit"))
      return {
        run: async () => {
          throw Error("injected audit failure");
        },
      };
    return prepare(sql);
  };
  await assert.rejects(setTestBalance(db, opts), /injected/);
  db.prepare = prepare;
  assert.deepEqual(await load(db, "target"), before);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) n FROM requests WHERE key=?")
        .get(OPERATION)
    ).n,
    0,
  );
});
test("admin CLI validates arguments without exposing an HTTP operation", () => {
  assert.deepEqual(
    parseArgs(["--username", "TaYuak", "--balance", "1000000000", "--dry-run"]),
    { username: "TaYuak", balance: BALANCE, dryRun: true },
  );
  assert.throws(() => parseArgs(["--confirm"]));
  assert.throws(() =>
    parseArgs(["--username", "TaYuak", "--username", "other"]),
  );
});

test("simultaneous admin retries record one adjustment", async (t) => {
  const db = await fixture(t);
  const both = await Promise.all([
    setTestBalance(db, opts),
    setTestBalance(db, opts),
  ]);
  assert.equal(both.filter((r) => r.alreadyApplied).length, 1);
  assert.equal((await load(db, "target")).pearls, BALANCE);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM audit WHERE action='admin_set_balance'",
        )
        .get()
    ).n,
    1,
  );
});
test("ordinary API clients cannot invoke the administrative balance change", async (t) => {
  const { createApp } = await import("../backend/server.js"),
    { createHash } = await import("node:crypto");
  const db = await fixture(t),
    token = "a".repeat(64);
  await db
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(
      createHash("sha256").update(token).digest("hex"),
      "target",
      Date.now() + 100000,
    );
  const app = await createApp({ db, production: true }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/`,
    headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    };
  assert.equal(
    (
      await fetch(url + "admin/set-balance", {
        method: "POST",
        headers,
        body: JSON.stringify({ username: TARGET, balance: BALANCE }),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(url + "action", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": "public-admin-attempt" },
        body: JSON.stringify({
          type: "admin_set_balance",
          payload: { username: TARGET, balance: BALANCE },
        }),
      })
    ).status,
    400,
  );
  assert.equal((await load(db, "target")).pearls, 3000);
});

test(
  "actual CLI dry-run and separately confirmed execution use the configured PostgreSQL database",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const { execFileSync } = await import("node:child_process"),
      db = await fixture(t);
    const args = [
      "scripts/admin-set-balance.js",
      "--username",
      TARGET,
      "--balance",
      String(BALANCE),
    ];
    const run = (flags) =>
      JSON.parse(
        execFileSync(process.execPath, [...args, ...flags], {
          env: { ...process.env, DATABASE_URL: db.testURL },
          encoding: "utf8",
        }),
      );
    assert.equal(run(["--dry-run"]).verifiedBalance, 3000);
    assert.equal((await load(db, "target")).pearls, 3000);
    assert.equal(
      run(["--confirm", "TaYuak:1000000000"]).verifiedBalance,
      BALANCE,
    );
    assert.equal(run(["--confirm", "TaYuak:1000000000"]).alreadyApplied, true);
    assert.equal((await load(db, "other")).pearls, 3000);
  },
);

test("existing inventory, rewards, ledger and audit history survive the adjustment", async (t) => {
  const db = await fixture(t);
  await action(db, "target", "buyFood", { count: 3 });
  const before = await load(db, "target"),
    history = await db.prepare("SELECT * FROM audit").all();
  await setTestBalance(db, opts);
  const after = await load(db, "target");
  assert.deepEqual(after.items, before.items);
  assert.deepEqual(after.fish, before.fish);
  assert.deepEqual(after.rewards, before.rewards);
  assert.deepEqual(after.ledger.slice(1), before.ledger);
  const rows = await db.prepare("SELECT * FROM audit ORDER BY id").all();
  assert.deepEqual(rows.slice(0, history.length), history);
  assert.equal(rows.length, history.length + 1);
  assert.equal(after.ledger[0].delta, BALANCE - before.pearls);
});
