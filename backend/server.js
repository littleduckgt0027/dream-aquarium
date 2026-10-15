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
  setMaintenance,
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
  db = openDB(),
  production = process.env.NODE_ENV === "production",
} = {}) {
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
  app.use("/api", express.json({ limit: "128kb" }));
  const limits = new Map();
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET") {
      const origin = req.get("origin");
      if (
        origin &&
        origin !==
          (process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`)
      )
        return res.status(403).json({ error: "Cross-origin request blocked" });
    }
    const key =
      req.socket.remoteAddress +
      (req.path.startsWith("/auth") ? ":auth" : ":game");
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
  function session(req, res, id) {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      id,
      Date.now() + 30 * 86400000,
    );
    res.cookie("dream_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: production && process.env.COOKIE_SECURE !== "false",
      maxAge: 30 * 86400000,
      path: "/",
    });
  }
  function auth(req, res, next) {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("dream_session="))
      ?.slice(14);
    const row =
      raw &&
      db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(digest(raw), Date.now());
    if (!row) return res.status(401).json({ error: "Please sign in" });
    req.user = row.user_id;
    req.session = digest(raw);
    next();
  }
  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", database: "ready" });
  });
  app.post("/api/auth/:operation", (req, res) => {
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
      const user = db
        .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
        .get(username);
      if (op === "register") {
        requireThat(
          db.prepare("SELECT value FROM meta WHERE key='maintenance'").get()
            .value === "0",
          "Maintenance: new aquarium registration is paused",
        );
        requireThat(!user, "Username already taken");
        const id = randomUUID(),
          code = randomBytes(24).toString("hex");
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
          id,
          username,
          hash(password),
          digest(code),
          JSON.stringify(initialState()),
        );
        save(db, id, load(db, id));
        session(req, res, id);
        return res.json({ recoveryCode: code });
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
        transaction(db, () => {
          db.prepare("UPDATE users SET password=?,recovery=? WHERE id=?").run(
            hash(password),
            digest(code),
            user.id,
          );
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
        });
        session(req, res, user.id);
        return res.json({ recoveryCode: code });
      }
      requireThat(
        user && verify(password, user.password),
        "Invalid username or password",
      );
      session(req, res, user.id);
      res.json({ ok: true });
    } catch (e) {
      res
        .status(e.status || 500)
        .json({ error: e.status ? e.message : "Authentication failed" });
    }
  });
  app.post("/api/logout", auth, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.session);
    res.clearCookie("dream_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/market", auth, (req, res) => {
    const result = transaction(db, () => {
      if (
        db.prepare("SELECT value FROM meta WHERE key='maintenance'").get()
          .value === "0"
      )
        settle(db);
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
      const total = db
        .prepare("SELECT count(*) total" + from)
        .get(...values).total;
      const page = Math.max(
        1,
        Math.min(Math.ceil(total / 24) || 1, Number.parseInt(q.page) || 1),
      );
      const items = db
        .prepare(
          "SELECT l.*,u.username seller_name" +
            from +
            " ORDER BY " +
            sort +
            " LIMIT 24 OFFSET ?",
        )
        .all(...values, (page - 1) * 24)
        .map((l) => ({ ...l, fish: JSON.parse(l.fish) }));
      return { items, total, page, pages: Math.ceil(total / 24) || 1 };
    });
    res.json(result);
  });
  app.get("/api/lineage/:id", auth, (req, res) => {
    const f = db
      .prepare("SELECT fish FROM lineage WHERE id=?")
      .get(req.params.id);
    if (!f) return res.status(404).json({ error: "Ancestor not found" });
    res.json(JSON.parse(f.fish));
  });
  app.get("/api/state", auth, (req, res) => {
    const state = transaction(db, () => {
      if (
        db.prepare("SELECT value FROM meta WHERE key='maintenance'").get()
          .value === "0"
      )
        settle(db);
      return publicState(db, req.user);
    });
    res.json(state);
  });
  app.post("/api/action", auth, (req, res) => {
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
      const result = transaction(db, () => {
        requireThat(
          db.prepare("SELECT value FROM meta WHERE key='maintenance'").get()
            .value === "0",
          "Maintenance: aquarium is view-only",
        );
        const old = db
          .prepare("SELECT * FROM requests WHERE user_id=? AND key=?")
          .get(req.user, key);
        if (old) {
          requireThat(
            old.body === body,
            "Idempotency key reused with different request",
          );
          return publicState(db, req.user);
        }
        settle(db);
        const state = action(db, req.user, type, payload);
        db.prepare("INSERT INTO requests VALUES(?,?,?,?)").run(
          req.user,
          key,
          body,
          "ok",
        );
        return state;
      });
      res.json(result);
    } catch (e) {
      if (!e.status) console.error(e);
      res.status(e.status || 500).json({
        error: e.status
          ? e.message
          : "Server error. No transaction was applied.",
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
  app.use((e, req, res, next) =>
    res.status(400).json({ error: "Invalid request" }),
  );
  app.locals.db = db;
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`Dream Aquarium listening on port ${port}`),
  );
  const ticker = setInterval(() => {
    try {
      transaction(app.locals.db, () => {
        if (
          app.locals.db
            .prepare("SELECT value FROM meta WHERE key='maintenance'")
            .get().value === "0"
        )
          settle(app.locals.db);
      });
    } catch (e) {
      console.error("Auction settlement failed", e.message);
    }
  }, 15000);
  ticker.unref();
  server.on("close", () => clearInterval(ticker));
}
