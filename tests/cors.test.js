import { testDatabase } from "./helpers/database.js";
import test from "node:test";
import assert from "node:assert/strict";
import { openDB } from "../backend/db.js";
import { createApp } from "../backend/server.js";
test("Pages cross-origin bearer sessions support refresh, actions and revocation; foreign origins blocked", async () => {
  const old = process.env.FRONTEND_ORIGIN;
  process.env.FRONTEND_ORIGIN = "https://littleduckgt0027.github.io";
  const db = await testDatabase();
  const app = await createApp({ db, production: true });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = process.env.FRONTEND_ORIGIN;
  try {
    const pre = await fetch(base + "/api/action", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Headers": "authorization,idempotency-key",
      },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), origin);
    assert.equal(
      (
        await fetch(base + "/api/health", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    const r = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "pages_keeper",
        password: "pages-safe-password",
      }),
    });
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    assert.match(r.headers.get("set-cookie"), /Secure/);
    assert.match(r.headers.get("set-cookie"), /SameSite=None/);
    assert.equal(r.headers.get("access-control-allow-credentials"), "true");
    const user = await r.json();
    assert.match(user.sessionToken, /^[a-f0-9]{64}$/);
    const headers = {
      Origin: origin,
      Authorization: "Bearer " + user.sessionToken,
    };
    assert.equal((await fetch(base + "/api/state", { headers })).status, 200);
    const roll = await fetch(base + "/api/action", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Idempotency-Key": "pages-roll-key",
      },
      body: JSON.stringify({ type: "gacha", payload: { count: 1 } }),
    });
    assert.equal((await roll.json()).pearls, 2900);
    await fetch(base + "/api/logout", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal((await fetch(base + "/api/state", { headers })).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    if (old === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = old;
  }
});
