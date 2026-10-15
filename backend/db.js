import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { openSQLite } from "./sqlite.js";

const context = new AsyncLocalStorage();
const queues = new WeakMap();
const migrations = [
  "001_initial.sql",
  "002_collectibles.sql",
  "003_fish_inventory.sql",
];

export function poolConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Error("DATABASE_URL must be a PostgreSQL connection string");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // pg connection-string SSL flags can override the ssl object. Remove them so
  // remote TLS always verifies the certificate and hostname, including sslmode=require.
  for (const name of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "ssl",
    "uselibpqcompat",
  ])
    url.searchParams.delete(name);
  const max = Number(process.env.DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 20)
    throw Error("DATABASE_POOL_MAX must be an integer from 1 to 20");
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    max,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    query_timeout: 30000,
    enableChannelBinding: true,
    application_name: "dream-aquarium",
    // Preserve the original numeric JS API for millisecond timestamps and money.
    types: {
      getTypeParser: (oid, format) =>
        oid === 20
          ? (v) => {
              const n = Number(v);
              if (!Number.isSafeInteger(n))
                throw Error("Database integer exceeds safe range");
              return n;
            }
          : pg.types.getTypeParser(oid, format),
    },
  };
}

// Small compatibility boundary for the legacy SQLite query syntax. All values
// remain parameters; question marks inside SQL string literals are untouched.
export function postgresSQL(sql) {
  sql = sql
    .replace(/json_extract\(l\.fish,'\$\.name'\)/g, "(l.fish::jsonb->>'name')")
    .replace(
      /json_extract\(l\.fish,'\$\.rarity'\)/g,
      "((l.fish::jsonb->>'rarity')::integer)",
    );
  const ignore = /^INSERT OR IGNORE /i.test(sql);
  if (ignore)
    sql =
      sql.replace(/^INSERT OR IGNORE /i, "INSERT ") + " ON CONFLICT DO NOTHING";
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|\?/g, (part) =>
    part === "?" ? `$${++index}` : part,
  );
}

export function openDB(path) {
  if (path !== undefined) return openSQLite(path);
  if (process.env.DATABASE_URL) return openPostgres(process.env.DATABASE_URL);
  if (
    process.env.RENDER ||
    (process.env.NODE_ENV === "production" && !process.env.DB_PATH)
  )
    throw Error(
      "DATABASE_URL is required for production; SQLite requires an explicit local DB_PATH",
    );
  return openSQLite();
}

export async function openPostgres(url) {
  const pool = new pg.Pool(poolConfig(url));
  pool.on("error", () =>
    console.error(
      "Database pool connection lost; new connections will be established on demand",
    ),
  );
  const db = {
    dialect: "postgres",
    pool,
    prepare(sql) {
      const query = async (params) => {
        const active = context.getStore();
        return (active?.db === db ? active.client : pool).query(
          postgresSQL(sql),
          params,
        );
      };
      return {
        get: async (...p) => (await query(p)).rows[0],
        all: async (...p) => (await query(p)).rows,
        run: async (...p) => ({ changes: (await query(p)).rowCount }),
      };
    },
    close: () => pool.end(),
  };
  try {
    await migrate(db);
    return db;
  } catch (e) {
    await pool.end();
    throw e;
  }
}

export async function migrate(db) {
  if (db.dialect !== "postgres") return;
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    // Transaction-scoped lock works through Neon's transaction pooler, too.
    await client.query("SELECT pg_advisory_xact_lock(72613001)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    for (const file of migrations) {
      if (
        (
          await client.query(
            "SELECT 1 FROM schema_migrations WHERE version=$1",
            [file],
          )
        ).rowCount
      )
        continue;
      await client.query(
        readFileSync(
          new URL(`../database/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
      await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        file,
      ]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function transaction(db, fn) {
  if (context.getStore()?.db === db) return fn();
  if (db.dialect === "postgres") {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query(
        "SET LOCAL idle_in_transaction_session_timeout = '30s'",
      );
      // One durable economy lock preserves the original serialized game rules
      // across requests, processes, scheduler ticks, recovery and maintenance.
      // Acquired BEFORE reads at READ COMMITTED, so every waiter sees the last commit.
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query(
        "SELECT value FROM meta WHERE key='maintenance' FOR UPDATE",
      );
      const result = await context.run({ db, client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  // Async game calls must not interleave inside a single SQLite connection.
  const prior = queues.get(db) || Promise.resolve();
  let unlock;
  const gate = new Promise((r) => {
    unlock = r;
  });
  queues.set(
    db,
    prior.then(() => gate),
  );
  await prior;
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ db }, fn);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } finally {
    unlock();
  }
}
