import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const health = await fetch(base + "/api/health");
assert.equal(health.status, 200);
const html = await (await fetch(base)).text();
assert.ok(html.includes("Dream Aquarium"));
const username = "smoke_" + Date.now();
const password = "smoke-test-only-" + crypto.randomUUID();
const register = await fetch(base + "/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
assert.equal(register.status, 200);
const cookie = register.headers.get("set-cookie").split(";")[0];
const state = await (
  await fetch(base + "/api/state", { headers: { Cookie: cookie } })
).json();
assert.equal(state.fish.length, 5);
assert.equal(state.pearls, 3000);
const roll = await fetch(base + "/api/action", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookie,
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({ type: "gacha", payload: { count: 1 } }),
});
assert.equal(roll.status, 200);
const after = await roll.json();
assert.equal(after.pearls, 2900);
assert.equal(after.fish.length, 6);
console.log(
  "Production container smoke passed: health, HTML, registration, database state, authoritative gacha.",
);

if (process.env.SMOKE_RESTART_CONTAINER) {
  execFileSync("docker", ["restart", process.env.SMOKE_RESTART_CONTAINER], {
    stdio: "ignore",
  });
  let restored;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(base + "/api/state", {
        headers: { Cookie: cookie },
      });
      if (r.ok) {
        restored = await r.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(restored, "Server must return after restart");
  assert.equal(restored.pearls, 2900);
  assert.equal(restored.fish.length, 6);
  assert.equal(restored.id, state.id);
  assert.deepEqual(
    restored.fish.map((f) => f.dna),
    after.fish.map((f) => f.dna),
  );
  console.log(
    "Container restart persistence passed: session, wallet, fish and DNA retained.",
  );
}
