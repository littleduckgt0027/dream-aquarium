import { testDatabase } from "./helpers/database.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/server.js";
import { openDB } from "../backend/db.js";
import { setMaintenance, load, save } from "../backend/game.js";
test("HTTP accounts, recovery, idempotency, race purchase, maintenance, persistence", async () => {
  const db = await testDatabase(),
    app = await createApp({ db, production: true }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, { body, cookie, key, origin } = {}) {
    const r = await fetch(base + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  try {
    assert.equal((await req("state")).status, 401);
    let a = await req("auth/register", {
      body: { username: "keeper_a", password: "safe-password-123" },
    });
    assert.equal(a.status, 200);
    const cookie = a.cookie,
      code = a.data.recoveryCode;
    assert.ok(code);
    assert.equal(
      (
        await req("auth/register", {
          body: { username: "keeper_a", password: "safe-password-123" },
        })
      ).status,
      400,
    );
    const state = (await req("state", { cookie })).data;
    const before = state.pearls;
    const body = { type: "gacha", payload: { count: 1 } };
    const both = await Promise.all([
      req("action", { cookie, key: "replay-key-1", body }),
      req("action", { cookie, key: "replay-key-1", body }),
    ]);
    assert.ok(both.every((r) => r.status === 200));
    assert.equal((await req("state", { cookie })).data.pearls, before - 100);
    assert.equal(
      (
        await req("action", {
          cookie,
          key: "replay-key-1",
          body: { type: "gacha", payload: { count: 10 } },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("action", {
          cookie,
          key: "evil-origin-1",
          origin: "https://evil.example",
          body,
        })
      ).status,
      403,
    );
    assert.equal((await req("action", { cookie, body })).status, 400);
    const b = await req("auth/register", {
        body: { username: "keeper_b", password: "safe-password-123" },
      }),
      c = await req("auth/register", {
        body: { username: "keeper_c", password: "safe-password-123" },
      });
    await req("action", {
      cookie,
      key: "listing-key-1",
      body: {
        type: "list",
        payload: { id: state.fish[0].id, type: "fixed", price: 1000 },
      },
    });
    const l = (await req("state", { cookie })).data.listings[0];
    const buyers = await Promise.all([
      req("action", {
        cookie: b.cookie,
        key: "buy-race-key-b",
        body: { type: "buy", payload: { id: l.id } },
      }),
      req("action", {
        cookie: c.cookie,
        key: "buy-race-key-c",
        body: { type: "buy", payload: { id: l.id } },
      }),
    ]);
    assert.deepEqual(buyers.map((r) => r.status).sort(), [200, 400]);
    assert.equal(
      (await req("state", { cookie })).data.pearls,
      before - 100 + 900,
    );
    await setMaintenance(db, true);
    assert.equal(
      (await req("action", { cookie, key: "maintenance-1", body })).status,
      400,
    );
    assert.equal((await req("state", { cookie })).data.maintenance, true);
    await setMaintenance(db, false);
    assert.equal(
      (
        await req("auth/login", {
          body: { username: "keeper_a", password: "wrong-password" },
        })
      ).status,
      400,
    );
    const recovered = await req("auth/recover", {
      body: {
        username: "keeper_a",
        password: "new-password-123",
        recovery: code,
      },
    });
    assert.equal(recovered.status, 200);
    assert.notEqual(recovered.data.recoveryCode, code);
    assert.equal((await req("state", { cookie })).status, 401);
    assert.equal(
      (await req("state", { cookie: recovered.cookie })).status,
      200,
    );
    assert.equal(
      (
        await req("auth/recover", {
          body: {
            username: "keeper_a",
            password: "another-password",
            recovery: code,
          },
        })
      ).status,
      400,
    );
    const login = await req("auth/login", {
      body: { username: "keeper_a", password: "new-password-123" },
    });
    assert.equal(login.status, 200);
    await req("logout", { cookie: login.cookie, body: {} });
    assert.equal((await req("state", { cookie: login.cookie })).status, 401);
    const raw = (
      await db.prepare("SELECT password FROM users WHERE id=?").get(state.id)
    ).password;
    assert.ok(!raw.includes("password"));
    assert.ok((await db.prepare("SELECT count(*) n FROM audit").get()).n >= 3);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
  }
});
