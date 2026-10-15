import { randomUUID } from "node:crypto";
const check = (ok, code = "invalid_request") => {
  if (!ok) {
    const e = Error("exp." + code);
    e.status = 400;
    throw e;
  }
};
function where(id, p) {
  const parts = ["user_id=?", "locked=0", "breeding=0", "limited IS NULL"],
    args = [id];
  if (p.tiers) {
    check(
      Array.isArray(p.tiers) &&
        p.tiers.length > 0 &&
        p.tiers.length <= 7 &&
        p.tiers.every((i) => Number.isInteger(i) && i >= 0 && i <= 6),
    );
    parts.push(`rarity IN (${p.tiers.map(() => "?").join(",")})`);
    args.push(...p.tiers);
  }
  if (p.search) {
    check(typeof p.search === "string" && p.search.length <= 80);
    parts.push("(LOWER(name) LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')");
    args.push("%" + p.search.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%");
    args.push("%" + p.search.replace(/[\\%_]/g, "\\$&") + "%");
  }
  if (p.location) {
    check(["storage", "tank"].includes(p.location));
    parts.push("location=?");
    args.push(p.location);
  }
  if (p.generation !== undefined && p.generation !== "") {
    const n = Number(p.generation);
    check(Number.isSafeInteger(n) && n >= 0);
    parts.push("generation=?");
    args.push(n);
  }
  if (p.ids) {
    check(
      Array.isArray(p.ids) &&
        p.ids.length > 0 &&
        p.ids.length <= 500 &&
        new Set(p.ids).size === p.ids.length,
    );
    parts.push(`id IN (${p.ids.map(() => "?").join(",")})`);
    args.push(...p.ids);
  }
  return { sql: parts.join(" AND "), args };
}
export function fishTicket(s, r, n) {
  for (const item of s.items.filter(
    (i) => i.type === "ticket" && i.rarity === r && i.count < 999,
  )) {
    const add = Math.min(n, 999 - item.count);
    item.count += add;
    item.stackable = true;
    n -= add;
    if (!n) return;
  }
  while (n) {
    const count = Math.min(n, 999);
    s.items.push({
      id: randomUUID(),
      type: "ticket",
      rarity: r,
      count,
      tradable: false,
      stackable: true,
    });
    n -= count;
  }
}
export async function fishBulkAction(db, id, type, p, s, now) {
  if (type === "fishLock") {
    const f = s.fish.find((f) => f.id === p.id);
    check(f && typeof p.locked === "boolean");
    f.locked = p.locked;
    return true;
  }
  if (type === "fishPreview") {
    check(["recycle", "delete"].includes(p.operation));
    const f = where(id, p),
      token = randomUUID();
    await db
      .prepare(
        "DELETE FROM inventory_previews WHERE user_id=? AND category='fish'",
      )
      .run(id);
    const rows = await db
      .prepare(
        `SELECT rarity,count(*) n FROM player_fish WHERE ${f.sql} GROUP BY rarity ORDER BY rarity`,
      )
      .all(...f.args);
    const summary = rows.map((g) => ({
      rarity: g.rarity,
      eligible: Number(g.n),
      consume:
        p.operation === "delete"
          ? Number(g.n)
          : Math.floor(Number(g.n) / 10) * 10,
      left: p.operation === "delete" ? 0 : Number(g.n) % 10,
      tickets: p.operation === "delete" ? 0 : Math.floor(Number(g.n) / 10),
    }));
    await db
      .prepare(
        "INSERT INTO inventory_previews(id,user_id,operation,category,created,summary) VALUES(?,?,?,?,?,?)",
      )
      .run(token, id, p.operation, "fish", now, JSON.stringify(summary));
    for (const g of summary)
      if (g.consume)
        await db
          .prepare(
            `INSERT INTO inventory_preview_rows(preview_id,instance_id,version,fingerprint) SELECT ?,id,0,data FROM player_fish WHERE ${f.sql} AND rarity=? ORDER BY ordinal,id LIMIT ?`,
          )
          .run(token, ...f.args, g.rarity, g.consume);
    s.itemPreview = {
      id: token,
      summary,
      total: summary.reduce((n, g) => n + g.consume, 0),
      expires: now + 600000,
    };
    return true;
  }
  if (type !== "fishCommit") return false;
  check(p.confirm === true, "confirmation");
  const v = await db
    .prepare(
      "SELECT * FROM inventory_previews WHERE id=? AND user_id=? AND category='fish'",
    )
    .get(p.previewId, id);
  check(v && !v.consumed && now - v.created <= 600000, "preview_expired");
  const summary = JSON.parse(v.summary),
    n = summary.reduce((n, g) => n + g.consume, 0);
  const valid = Number(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM player_fish f JOIN inventory_preview_rows r ON r.instance_id=f.id WHERE r.preview_id=? AND f.user_id=? AND r.fingerprint=f.data AND f.locked=0 AND f.breeding=0 AND f.limited IS NULL",
        )
        .get(v.id, id)
    ).n,
  );
  check(valid === n, "selection_changed");
  await db
    .prepare(
      "INSERT INTO inventory_consumptions(preview_id,instance_id,user_id,category) SELECT preview_id,instance_id,?,? FROM inventory_preview_rows WHERE preview_id=?",
    )
    .run(id, "fish", v.id);
  await db
    .prepare("INSERT INTO audit(time,user_id,action,detail) VALUES(?,?,?,?)")
    .run(
      now,
      id,
      "inventoryConsumed",
      JSON.stringify({
        previewId: v.id,
        category: "fish",
        operation: v.operation,
        summary,
      }),
    );
  await db
    .prepare(
      "UPDATE collectible_instances SET fish_id=NULL,slot=NULL,version=version+1 WHERE user_id=? AND fish_id IN (SELECT instance_id FROM inventory_preview_rows WHERE preview_id=?)",
    )
    .run(id, v.id);
  await db
    .prepare(
      "DELETE FROM player_fish WHERE user_id=? AND id IN (SELECT instance_id FROM inventory_preview_rows WHERE preview_id=?)",
    )
    .run(id, v.id);
  // The action loads no selected fish, so its normal state save cannot reinsert consumed rows.
  if (v.operation === "recycle")
    for (const g of summary) if (g.tickets) fishTicket(s, g.rarity, g.tickets);
  await db
    .prepare("UPDATE inventory_previews SET consumed=1 WHERE id=?")
    .run(v.id);
  s.itemPreview = null;
  s.itemOperation = { summary, total: n };
  return true;
}
