if (process.argv.includes("--production")) process.env.NODE_ENV = "production";
import express from "express";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDB, transaction } from "./db.js";
import {
  initialState,
  load,
  save,
  publicState,
  action,
  settle,
  requireThat,
} from "./game.js";
const digest = (s) => createHash("sha256").update(s).digest("hex");
function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password, salt, 64),
  );
}
export async function createApp({
  db,
  production = process.env.NODE_ENV === "production",
} = {}) {
  if (process.env.RENDER) {
    if (
      !production ||
      process.env.COOKIE_SECURE !== "true" ||
      process.env.TRUST_PROXY_HOPS !== "1"
    )
      throw Error(
        "Render requires production mode, COOKIE_SECURE=true and TRUST_PROXY_HOPS=1",
      );
    for (const name of ["PUBLIC_ORIGIN", "FRONTEND_ORIGIN"]) {
      let url;
      try {
        url = new URL(process.env[name]);
      } catch {
        throw Error(`${name} must be an HTTPS origin`);
      }
      if (url.protocol !== "https:" || url.origin !== process.env[name])
        throw Error(
          `${name} must be an HTTPS origin without a path or trailing slash`,
        );
    }
  }
  db ??= await openDB();
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (production)
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
      );
    next();
  });
  if (process.env.TRUST_PROXY_HOPS)
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    const own =
      process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const remote = process.env.FRONTEND_ORIGIN;
    if (origin && origin !== own && origin !== remote)
      return res.status(403).json({ error: "Cross-origin request blocked" });
    if (origin && origin === remote && origin !== own) {
      req.remoteFrontend = true;
      res.set({
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, Idempotency-Key",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use("/api", express.json({ limit: "128kb" }));
  const limits = new Map();
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const key = req.ip + (req.path.startsWith("/auth") ? ":auth" : ":game");
    const now = Date.now();
    let l = limits.get(key);
    if (!l || now > l.end) {
      l = { n: 0, end: now + 60000 };
      limits.set(key, l);
    }
    if (++l.n > (key.endsWith(":auth") ? 40 : 600))
      return res
        .status(429)
        .json({ error: "Too many requests. Please wait a minute." });
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.end < now) limits.delete(k);
    next();
  });
  async function session(req, res, id) {
    const token = randomBytes(32).toString("hex");
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(token), id, Date.now() + 30 * 86400000);
    res.cookie("dream_session", token, {
      httpOnly: true,
      sameSite: req.remoteFrontend && production ? "none" : "strict",
      secure: production && process.env.COOKIE_SECURE !== "false",
      maxAge: 30 * 86400000,
      path: "/",
    });
    return req.remoteFrontend ? { sessionToken: token } : {};
  }
  async function auth(req, res, next) {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("dream_session="))
      ?.slice(14);
    const bearer = req
      .get("authorization")
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const raw = bearer || cookie;
    const row =
      raw &&
      (await db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(digest(raw), Date.now()));
    if (!row) return res.status(401).json({ error: "Please sign in" });
    req.user = row.user_id;
    req.session = digest(raw);
    next();
  }
  async function requireSession(req) {
    const row = await db
      .prepare("SELECT user_id FROM sessions WHERE token=? AND expires>?")
      .get(req.session, Date.now());
    if (!row) {
      const e = Error("Please sign in");
      e.status = 401;
      throw e;
    }
  }
  app.get("/api/health", async (req, res) => {
    try {
      await db.prepare("SELECT 1").get();
      res.json({
        status: "ok",
        database: "ready",
        databaseEngine: db.dialect === "postgres" ? "postgresql" : "sqlite",
        application: "dream-aquarium",
        instanceId: process.env.LAUNCHER_INSTANCE || null,
      });
    } catch {
      res.status(503).json({
        status: "unavailable",
        database: "unavailable",
        application: "dream-aquarium",
      });
    }
  });
  app.post("/api/auth/:operation", async (req, res) => {
    try {
      const { username, password, recovery } = req.body;
      const op = req.params.operation;
      requireThat(
        ["register", "login", "recover"].includes(op),
        "Unknown operation",
      );
      requireThat(
        typeof username === "string" && /^[a-zA-Z0-9_]{3,24}$/.test(username),
        "Username: 3–24 letters, numbers or underscore",
      );
      requireThat(
        typeof password === "string" &&
          password.length >= 10 &&
          password.length <= 128,
        "Password: 10–128 characters",
      );
      const result = await transaction(db, async () => {
        const user = await db
          .prepare("SELECT * FROM users WHERE LOWER(username)=LOWER(?)")
          .get(username);
        if (op === "register") {
          requireThat(
            (
              await db
                .prepare("SELECT value FROM meta WHERE key='maintenance'")
                .get()
            ).value === "0",
            "Maintenance: new aquarium registration is paused",
          );
          requireThat(!user, "Username already taken");
          const id = randomUUID(),
            code = randomBytes(24).toString("hex");
          await db
            .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
            .run(
              id,
              username,
              hash(password),
              digest(code),
              JSON.stringify(initialState()),
            );
          await save(db, id, await load(db, id));
          const auth = await session(req, res, id);
          return { recoveryCode: code, ...auth };
        }
        if (op === "recover") {
          requireThat(
            user &&
              typeof recovery === "string" &&
              timingSafeEqual(
                Buffer.from(user.recovery),
                Buffer.from(digest(recovery)),
              ),
            "Invalid account or recovery code",
          );
          const code = randomBytes(24).toString("hex");
          await transaction(db, async () => {
            await db
              .prepare("UPDATE users SET password=?,recovery=? WHERE id=?")
              .run(hash(password), digest(code), user.id);
            await db
              .prepare("DELETE FROM sessions WHERE user_id=?")
              .run(user.id);
          });
          const auth = await session(req, res, user.id);
          return { recoveryCode: code, ...auth };
        }
        requireThat(
          user && verify(password, user.password),
          "Invalid username or password",
        );
        const auth = await session(req, res, user.id);
        return { ok: true, ...auth };
      });
      res.json(result);
    } catch (e) {
      res
        .status(e.status || 500)
        .json({ error: e.status ? e.message : "Authentication failed" });
    }
  });
  app.post("/api/logout", auth, async (req, res) => {
    await transaction(db, async () => {
      await db.prepare("DELETE FROM sessions WHERE token=?").run(req.session);
    });
    res.clearCookie("dream_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/market", auth, async (req, res) => {
    const result = await transaction(db, async () => {
      await requireSession(req);
      if (
        (
          await db
            .prepare("SELECT value FROM meta WHERE key='maintenance'")
            .get()
        ).value === "0"
      )
        await settle(db);
      const clauses = ["l.status='open'"],
        values = [];
      const q = req.query;
      if (typeof q.search === "string" && q.search) {
        clauses.push(
          "LOWER(u.username||' '||json_extract(l.fish,'$.name')) LIKE ?",
        );
        values.push("%" + q.search.toLowerCase().slice(0, 100) + "%");
      }
      if (["fixed", "auction"].includes(q.type)) {
        clauses.push("l.type=?");
        values.push(q.type);
      }
      if (q.type === "mine") {
        clauses.push("l.seller=?");
        values.push(req.user);
      }
      if (/^[0-6]$/.test(q.rarity || "")) {
        clauses.push("json_extract(l.fish,'$.rarity')=?");
        values.push(Number(q.rarity));
      }
      const sort =
        q.sort === "price"
          ? "CASE WHEN l.bid>0 THEN l.bid ELSE l.price END ASC"
          : q.sort === "ending"
            ? "l.end_at IS NULL,l.end_at ASC"
            : "json_extract(l.fish,'$.rarity') DESC,l.rowid DESC";
      const from =
        " FROM listings l JOIN users u ON l.seller=u.id WHERE " +
        clauses.join(" AND ");
      const total = (
        await db.prepare("SELECT count(*) total" + from).get(...values)
      ).total;
      const page = Math.max(
        1,
        Math.min(Math.ceil(total / 24) || 1, Number.parseInt(q.page) || 1),
      );
      const items = (
        await db
          .prepare(
            "SELECT l.*,u.username seller_name" +
              from +
              " ORDER BY " +
              sort +
              " LIMIT 24 OFFSET ?",
          )
          .all(...values, (page - 1) * 24)
      ).map((l) => ({ ...l, fish: JSON.parse(l.fish) }));
      return { items, total, page, pages: Math.ceil(total / 24) || 1 };
    });
    res.json(result);
  });
  app.get("/api/lineage/:id", auth, async (req, res) => {
    const f = await db
      .prepare("SELECT fish FROM lineage WHERE id=?")
      .get(req.params.id);
    if (!f) return res.status(404).json({ error: "Ancestor not found" });
    res.json(JSON.parse(f.fish));
  });
  app.get("/api/state", auth, async (req, res) => {
    const state = await transaction(db, async () => {
      await requireSession(req);
      if (
        (
          await db
            .prepare("SELECT value FROM meta WHERE key='maintenance'")
            .get()
        ).value === "0"
      )
        await settle(db);
      return await publicState(db, req.user);
    });
    res.json(state);
  });
  app.post("/api/action", auth, async (req, res) => {
    try {
      const key = req.get("Idempotency-Key");
      requireThat(
        typeof key === "string" && /^[\w-]{8,100}$/.test(key),
        "Idempotency key required",
      );
      const { type, payload = {} } = req.body;
      requireThat(
        typeof type === "string" && payload && typeof payload === "object",
        "Invalid request",
      );
      const body = JSON.stringify(req.body);
      const result = await transaction(db, async () => {
        await requireSession(req);
        requireThat(
          (
            await db
              .prepare("SELECT value FROM meta WHERE key='maintenance'")
              .get()
          ).value === "0",
          "Maintenance: aquarium is view-only",
        );
        const old = await db
          .prepare("SELECT * FROM requests WHERE user_id=? AND key=?")
          .get(req.user, key);
        if (old) {
          requireThat(
            old.body === body,
            "Idempotency key reused with different request",
          );
          return await publicState(db, req.user);
        }
        await settle(db);
        const state = await action(db, req.user, type, payload);
        await db
          .prepare("INSERT INTO requests VALUES(?,?,?,?)")
          .run(req.user, key, body, "ok");
        return state;
      });
      res.json(result);
    } catch (e) {
      if (!e.status)
        console.error("Game transaction failed", e.code || "internal");
      res.status(e.status || 503).json({
        error: e.status
          ? e.message
          : "Server could not confirm the result. Reconnect and retry with the same request key.",
      });
    }
  });
  if (production) {
    app.use(express.static(resolve("dist")));
    app.get(/^(?!\/api).*/, (_, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.locals.vite = vite;
  }
  app.use((e, req, res, next) => {
    const status = e.status || 503;
    res.status(status).json({
      error:
        status < 500
          ? e.message
          : "Database temporarily unavailable. Please retry.",
    });
  });
  app.locals.db = db;
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, process.env.HOST || "0.0.0.0", () =>
    console.log(`Dream Aquarium listening on port ${server.address().port}`),
  );
  let ticking = false,
    stopping = false;
  const ticker = setInterval(async () => {
    if (ticking || stopping) return;
    ticking = true;
    try {
      await transaction(app.locals.db, async () => {
        if (
          (
            await app.locals.db
              .prepare("SELECT value FROM meta WHERE key='maintenance'")
              .get()
          ).value === "0"
        )
          await settle(app.locals.db);
      });
    } catch (e) {
      console.error("Auction settlement failed", e.code || "internal");
    } finally {
      ticking = false;
    }
  }, 15000);
  ticker.unref();
  server.on("close", () => clearInterval(ticker));
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      stopping = true;
      clearInterval(ticker);
      server.close(async () => {
        // pool.end waits for in-flight transactions before shutdown.
        await app.locals.db.close();
        process.exit(0);
      });
    });
}
