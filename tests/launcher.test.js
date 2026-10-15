import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
function run(root, action, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/launcher.js", action], {
      cwd: root,
      env: {
        ...process.env,
        DREAM_NO_BROWSER: "1",
        DREAM_PORT: String(port),
        npm_config_cache:
          process.env.npm_config_cache ||
          join(tmpdir(), "dream-launcher-test-cache"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (s) => (output += s));
    child.stderr.on("data", (s) => (output += s));
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error("Launcher timed out: " + output));
    }, 90000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}
async function freePort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
test(
  "launcher from fresh folder with spaces installs/builds, reuses, stops, restarts and preserves data",
  { timeout: 180000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "Dream Aquarium launcher ")),
      port = await freePort();
    try {
      for (const f of [
        "scripts",
        "backend",
        "frontend",
        "shared",
        "package.json",
        "package-lock.json",
        "vite.config.js",
      ])
        cpSync(f, join(dir, f), { recursive: true });
      const first = await run(dir, "start", port);
      assert.equal(first.code, 0, first.output);
      const before = JSON.parse(readFileSync(join(dir, "data/launcher.json")));
      const h = await (
        await fetch(`http://127.0.0.1:${port}/api/health`)
      ).json();
      assert.equal(h.instanceId, before.instanceId);
      assert.ok(existsSync(join(dir, "dist/index.html")));
      const apiBase = `http://127.0.0.1:${port}/api/`;
      const registered = await fetch(apiBase + "auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "launcher_keeper",
          password: "launcher-test-password",
        }),
      });
      assert.equal(registered.status, 200);
      const cookie = registered.headers.get("set-cookie").split(";")[0];
      const rolled = await fetch(apiBase + "action", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": "launcher-gacha-key",
        },
        body: JSON.stringify({ type: "gacha", payload: { count: 1 } }),
      });
      const player = await rolled.json();
      assert.equal(player.pearls, 2900);

      assert.equal((await run(dir, "start", port)).code, 0);
      assert.equal(
        JSON.parse(readFileSync(join(dir, "data/launcher.json"))).pid,
        before.pid,
      );
      assert.equal((await run(dir, "stop", port)).code, 0);
      assert.equal((await run(dir, "stop", port)).code, 0);
      const again = await run(dir, "start", port);
      assert.equal(again.code, 0, again.output);
      assert.ok(!again.output.includes("Preparing game dependencies"));
      assert.ok(!again.output.includes("Building your aquarium"));
      const restoredResponse = await fetch(apiBase + "state", {
        headers: { Cookie: cookie },
      });
      assert.equal(restoredResponse.status, 200);
      const restored = await restoredResponse.json();
      assert.equal(restored.pearls, 2900);
      assert.deepEqual(
        restored.fish.map((f) => f.dna),
        player.fish.map((f) => f.dna),
      );
      assert.equal((await run(dir, "stop", port)).code, 0);
      const asset = readFileSync(join(dir, "dist/index.html"), "utf8").match(
        /src="(\/assets\/[^" ]+)"/,
      )[1];
      rmSync(join(dir, "dist", asset.slice(1)));
      const repaired = await run(dir, "start", port);
      assert.equal(repaired.code, 0, repaired.output);
      assert.ok(repaired.output.includes("Building your aquarium"));
    } finally {
      await run(dir, "stop", port);
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
test("launcher refuses a foreign server and never kills its process", async () => {
  const dir = mkdtempSync(join(tmpdir(), "Dream conflict "));
  cpSync("scripts", join(dir, "scripts"), { recursive: true });
  const server = net.createServer((s) => s.end());
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const r = await run(dir, "start", server.address().port);
    assert.equal(r.code, 1);
    assert.match(r.output, /another application/);
    assert.ok(server.listening);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dir, { recursive: true, force: true });
  }
});
