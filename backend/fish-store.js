import { growth } from "./genetics.js";
import { transaction } from "./db.js";
const snapshot = Symbol("fishSnapshot");
export async function readPlayer(db, id, options) {
  return transaction(db, async () => {
    const row = await db.prepare("SELECT state FROM users WHERE id=?").get(id);
    if (!row) {
      const e = Error("Player not found");
      e.status = 400;
      throw e;
    }
    const s = JSON.parse(row.state);
    if (!s.fishRows) {
      await writeFish(db, id, s.fish || []);
      const active = [
        ...new Set(
          (s.breeds || []).filter((b) => !b.claimed).flatMap((b) => b.parents),
        ),
      ];
      for (let at = 0; at < active.length; at += 250) {
        const batch = active.slice(at, at + 250);
        await db
          .prepare(
            `UPDATE player_fish SET breeding=1 WHERE user_id=? AND id IN (${batch.map(() => "?").join(",")})`,
          )
          .run(id, ...batch);
      }
      s.fishRows = true;
      delete s.fish;
      await db
        .prepare("UPDATE users SET state=? WHERE id=?")
        .run(JSON.stringify(s), id);
    }
    let rows;
    if (options?.ids) {
      const ids = [
        ...new Set(options.ids.filter((i) => typeof i === "string")),
      ];
      rows = ids.length
        ? await db
            .prepare(
              `SELECT data FROM player_fish WHERE user_id=? AND id IN (${ids.map(() => "?").join(",")})`,
            )
            .all(id, ...ids)
        : [];
    } else if (options?.bounded) {
      rows = await db
        .prepare(
          "SELECT data FROM player_fish WHERE user_id=? AND location='tank' ORDER BY ordinal,id LIMIT 240",
        )
        .all(id);
      if (rows.length < 240)
        rows.push(
          ...(await db
            .prepare(
              "SELECT data FROM player_fish WHERE user_id=? AND location='storage' ORDER BY ordinal,id LIMIT ?",
            )
            .all(id, 240 - rows.length)),
        );
    } else
      rows = await db
        .prepare(
          "SELECT data FROM player_fish WHERE user_id=? ORDER BY ordinal,id",
        )
        .all(id);
    s.fish = rows.map((r) => JSON.parse(r.data));
    const counts = await fishCounts(db, id);
    Object.defineProperty(s, snapshot, {
      value: {
        ids: s.fish.map((f) => f.id),
        storage: counts.storage,
        loadedStorage: s.fish.filter((f) => f.location === "storage").length,
      },
      writable: true,
      configurable: true,
    });
    s.fishCounts = counts;
    return s;
  });
}
export async function fishCounts(db, id) {
  const rows = await db
    .prepare(
      "SELECT location,count(*) n FROM player_fish WHERE user_id=? GROUP BY location",
    )
    .all(id);
  const result = { tank: 0, storage: 0, total: 0 };
  for (const r of rows) {
    result[r.location] = Number(r.n);
    result.total += Number(r.n);
  }
  return result;
}
export function storageCount(s) {
  const before = s[snapshot];
  return before
    ? before.storage -
        before.loadedStorage +
        s.fish.filter((f) => f.location === "storage").length
    : s.fish.filter((f) => f.location === "storage").length;
}
async function writeFish(db, id, fish) {
  const last = Number(
    (
      await db
        .prepare(
          "SELECT COALESCE(MAX(ordinal),0) n FROM player_fish WHERE user_id=?",
        )
        .get(id)
    ).n,
  );
  for (let at = 0; at < fish.length; at += 100) {
    const batch = fish.slice(at, at + 100);
    await db
      .prepare(
        "INSERT INTO player_fish(id,user_id,rarity,name,generation,location,limited,locked,born,mature_at,ordinal,data) VALUES " +
          batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",") +
          " ON CONFLICT(id) DO UPDATE SET rarity=excluded.rarity,name=excluded.name,generation=excluded.generation,location=excluded.location,limited=excluded.limited,locked=excluded.locked,born=excluded.born,mature_at=excluded.mature_at,data=excluded.data WHERE player_fish.user_id=excluded.user_id",
      )
      .run(
        ...batch.flatMap((f, i) => [
          f.id,
          id,
          f.rarity,
          f.name,
          f.generation || 0,
          f.location,
          f.limited || null,
          f.locked ? 1 : 0,
          f.born,
          Math.round(f.born + 86400000 * f.dna.growth - (f.boost || 0)),
          last + at + i + 1,
          JSON.stringify(f),
        ]),
      );
  }
}
export async function writePlayer(db, id, s) {
  const before = s[snapshot];
  if (s.fish) {
    const remain = new Set(s.fish.map((f) => f.id));
    const gone = (before?.ids || []).filter((id) => !remain.has(id));
    for (let at = 0; at < gone.length; at += 250) {
      const ids = gone.slice(at, at + 250);
      await db
        .prepare(
          `DELETE FROM player_fish WHERE user_id=? AND id IN (${ids.map(() => "?").join(",")})`,
        )
        .run(id, ...ids);
    }
    await writeFish(db, id, s.fish);
  }
  await db
    .prepare("UPDATE player_fish SET breeding=0 WHERE user_id=? AND breeding=1")
    .run(id);
  const parents = [
    ...new Set(s.breeds.filter((b) => !b.claimed).flatMap((b) => b.parents)),
  ];
  for (let at = 0; at < parents.length; at += 250) {
    const batch = parents.slice(at, at + 250);
    await db
      .prepare(
        `UPDATE player_fish SET breeding=1 WHERE user_id=? AND id IN (${batch.map(() => "?").join(",")})`,
      )
      .run(id, ...batch);
  }
  const { fish, fishCounts, ...document } = s;
  document.fishRows = true;
  await db
    .prepare("UPDATE users SET state=? WHERE id=?")
    .run(JSON.stringify(document), id);
  if (s.fish)
    Object.defineProperty(s, snapshot, {
      value: {
        ids: s.fish.map((f) => f.id),
        storage: await storageTotal(db, id),
        loadedStorage: s.fish.filter((f) => f.location === "storage").length,
      },
      writable: true,
      configurable: true,
    });
}
async function storageTotal(db, id) {
  return (await fishCounts(db, id)).storage;
}
export async function fishPage(db, id, p = {}) {
  await readPlayer(db, id, { ids: [] });
  const where = ["user_id=?"],
    args = [id];
  if (p.mature !== undefined) {
    if (!["true", "false"].includes(p.mature))
      throw Object.assign(Error("exp.invalid_request"), { status: 400 });
    where.push(p.mature === "true" ? "mature_at<=?" : "mature_at>?");
    args.push(Date.now());
  }
  if (p.location) {
    if (!["tank", "storage"].includes(p.location))
      throw Object.assign(Error("exp.invalid_request"), { status: 400 });
    where.push("location=?");
    args.push(p.location);
  }
  if (p.tiers) {
    if (
      !Array.isArray(p.tiers) ||
      p.tiers.length < 1 ||
      p.tiers.length > 7 ||
      !p.tiers.every((r) => Number.isInteger(r) && r >= 0 && r <= 6)
    )
      throw Object.assign(Error("exp.invalid_request"), { status: 400 });
    where.push(`rarity IN (${p.tiers.map(() => "?").join(",")})`);
    args.push(...p.tiers);
  }
  if (p.search) {
    if (typeof p.search !== "string" || p.search.length > 80)
      throw Object.assign(Error("exp.invalid_request"), { status: 400 });
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')");
    args.push("%" + p.search.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%");
    args.push("%" + p.search.replace(/[\\%_]/g, "\\$&") + "%");
  }
  if (p.generation !== undefined && p.generation !== "") {
    const n = Number(p.generation);
    if (!Number.isSafeInteger(n) || n < 0)
      throw Object.assign(Error("exp.invalid_request"), { status: 400 });
    where.push("generation=?");
    args.push(n);
  }
  const sort = {
    newest: "ordinal DESC,id",
    name: "name,id",
    rarity: "rarity DESC,id",
    generation: "generation DESC,id",
    age: "born,id",
  }[p.sort || "rarity"];
  const page = Number(p.page || 1);
  if (!sort || !Number.isSafeInteger(page) || page < 1 || page > 2000)
    throw Object.assign(Error("exp.invalid_request"), { status: 400 });
  const sql = where.join(" AND "),
    total = Number(
      (
        await db
          .prepare(`SELECT count(*) n FROM player_fish WHERE ${sql}`)
          .get(...args)
      ).n,
    );
  const eligibleTotal = Number(
    (
      await db
        .prepare(
          `SELECT count(*) n FROM player_fish WHERE ${sql} AND locked=0 AND breeding=0 AND limited IS NULL`,
        )
        .get(...args)
    ).n,
  );
  const rows = (
    await db
      .prepare(
        `SELECT data,locked,breeding FROM player_fish WHERE ${sql} ORDER BY ${sort} LIMIT 48 OFFSET ?`,
      )
      .all(...args, (page - 1) * 48)
  ).map((r) => {
    const f = JSON.parse(r.data);
    return {
      ...f,
      owned: true,
      growth: growth(f),
      restricted: !!r.locked || !!r.breeding || !!f.limited,
    };
  });
  return { rows, total, eligibleTotal, page, pageSize: 48 };
}
