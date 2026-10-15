import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  openSync,
  closeSync,
  readdirSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import net from "node:net";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  data = join(root, "data");
const recordPath = join(data, "launcher.json"),
  lockPath = join(data, "launcher.lock");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function read(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function health(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
async function occupied(port) {
  return new Promise((r) => {
    const s = net.connect({ host: "127.0.0.1", port });
    s.once("connect", () => {
      s.destroy();
      r(true);
    });
    s.once("error", () => r(false));
  });
}
function browser(port) {
  const url = `http://127.0.0.1:${port}`;
  console.log("Game ready: " + url);
  if (process.env.DREAM_NO_BROWSER === "1") return;
  const command =
    process.platform === "win32"
      ? "cmd.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `start "" "${url}"`]
      : [url];
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.on("error", () =>
    console.log("Open the address above in your browser."),
  );
  child.unref();
}
function command(args, env) {
  const p = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (p.error || p.status !== 0)
    throw Error(
      "Setup failed. Check the error above. Internet access is needed for the first dependency installation.",
    );
}
function npm(args, env) {
  const p =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec || "cmd.exe",
          ["/d", "/s", "/c", "npm " + args.join(" ")],
          { cwd: root, env, stdio: "inherit" },
        )
      : spawnSync("npm", args, { cwd: root, env, stdio: "inherit" });
  if (p.error || p.status !== 0)
    throw Error(
      "Dependency installation or build failed. Check the message above and retry.",
    );
}
function fingerprint() {
  const hash = createHash("sha256");
  function add(p) {
    if (!existsSync(p)) return;
    for (const ent of readdirSync(p, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const f = join(p, ent.name);
      if (ent.isDirectory()) add(f);
      else hash.update(readFileSync(f));
    }
  }
  add(join(root, "frontend"));
  add(join(root, "shared"));
  for (const f of ["package.json", "package-lock.json", "vite.config.js"])
    hash.update(readFileSync(join(root, f)));
  return hash.digest("hex");
}
function builtHash() {
  try {
    const html = readFileSync(join(root, "dist", "index.html"), "utf8");
    const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(
      (m) => m[1],
    );
    if (
      !files.length ||
      files.some((f) => !existsSync(join(root, "dist", f.slice(1))))
    )
      return null;
    return createHash("sha256").update(html).digest("hex");
  } catch {
    return null;
  }
}
async function stop() {
  const rec = read(recordPath);
  if (!rec) {
    console.log("Dream Aquarium is already stopped.");
    return;
  }
  const h = await health(rec.port);
  if (h?.application !== "dream-aquarium" || h.instanceId !== rec.instanceId) {
    rmSync(recordPath, { force: true });
    console.log(
      "No matching game process found. Other applications were left running.",
    );
    return;
  }
  if (!Number.isInteger(rec.pid) || rec.pid <= 1)
    throw Error("Invalid launcher record. No process was stopped.");
  process.kill(rec.pid, "SIGTERM");
  for (let i = 0; i < 50; i++) {
    if (!(await occupied(rec.port))) {
      rmSync(recordPath, { force: true });
      console.log("Dream Aquarium stopped. Your aquarium is saved.");
      return;
    }
    await pause(100);
  }
  throw Error("The server is still stopping. Please retry STOP-GAME.bat.");
}
async function start() {
  const config = read(join(root, "launcher.local.json")) || {};
  const port = Number(process.env.DREAM_PORT || config.port || 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Game port must be between 1024 and 65535.");
  const rec = read(recordPath);
  if (rec) {
    const h = await health(rec.port);
    if (
      h?.application === "dream-aquarium" &&
      h.instanceId === rec.instanceId
    ) {
      browser(rec.port);
      return;
    }
  }
  if (await occupied(port))
    throw Error(
      `Port ${port} is used by another application. No process was stopped. Choose another port in launcher.local.json (see launcher.local.example.json).`,
    );
  mkdirSync(data, { recursive: true });
  try {
    mkdirSync(lockPath);
  } catch {
    const owner = read(join(lockPath, "owner.json"));
    if (owner && !alive(owner.pid)) {
      rmSync(lockPath, { recursive: true, force: true });
      mkdirSync(lockPath);
    } else
      throw Error(
        "Dream Aquarium is already starting. Please wait for its window to finish.",
      );
  }
  writeFileSync(
    join(lockPath, "owner.json"),
    JSON.stringify({ pid: process.pid }),
  );
  let child;
  try {
    const stamp = join(data, "launcher-build.json"),
      old = read(stamp),
      digest = fingerprint();
    const env = {
      ...process.env,
      DB_PATH: join(data, "aquarium.sqlite"),
      COOKIE_SECURE: "false",
      PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
      FRONTEND_ORIGIN: "",
      VITE_BASE: "/",
      VITE_API_URL: "",
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
    };
    const lockHash = createHash("sha256")
      .update(readFileSync(join(root, "package-lock.json")))
      .digest("hex");
    if (
      !existsSync(join(root, "node_modules", "express", "package.json")) ||
      old?.lockHash !== lockHash
    ) {
      console.log("Preparing game dependencies…");
      npm(["ci", "--include=dev", "--cache=data/npm-cache"], env);
    }
    command(["backend/migrate.js"], env);
    if (
      !builtHash() ||
      old?.builtHash !== builtHash() ||
      old?.digest !== digest
    ) {
      console.log("Building your aquarium…");
      npm(["run", "build"], env);
    }
    writeFileSync(
      stamp,
      JSON.stringify({ lockHash, digest, builtHash: builtHash() }),
    );
    const instanceId = randomUUID();
    const log = openSync(join(data, "launcher.log"), "a");
    try {
      child = spawn(process.execPath, ["backend/server.js", "--production"], {
        cwd: root,
        env: { ...env, LAUNCHER_INSTANCE: instanceId },
        stdio: ["ignore", log, log],
        detached: true,
        windowsHide: true,
      });
    } finally {
      closeSync(log);
    }
    await new Promise((res, rej) => {
      child.once("spawn", res);
      child.once("error", rej);
    });
    child.unref();
    writeFileSync(
      recordPath,
      JSON.stringify({ pid: child.pid, port, instanceId }),
    );
    for (let i = 0; i < 120; i++) {
      const h = await health(port);
      if (h?.application === "dream-aquarium" && h.instanceId === instanceId) {
        browser(port);
        return;
      }
      if (!alive(child.pid)) break;
      await pause(250);
    }
    throw Error("Server did not become ready. See data/launcher.log.");
  } catch (e) {
    if (child?.pid && alive(child.pid)) process.kill(child.pid, "SIGTERM");
    rmSync(recordPath, { force: true });
    throw e;
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}
try {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw Error(
      "Please install Node.js 24 LTS from https://nodejs.org then try again.",
    );
  if (process.argv[2] === "stop") await stop();
  else if (process.argv[2] === "start") await start();
  else throw Error("Usage: node scripts/launcher.js start|stop");
} catch (e) {
  console.error("\nDream Aquarium: " + e.message);
  process.exitCode = 1;
}
