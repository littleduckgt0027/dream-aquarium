import { randomUUID, randomInt } from "node:crypto";
import {
  CATALOG,
  CATEGORIES,
  ITEM_CAPACITY,
  ITEM_ROLLS,
  MAX_PLACEMENTS,
  PAGE_SIZE,
  definition,
} from "../shared/collectibles.js";
import { rarity } from "./genetics.js";
const check = (ok, code = "invalid_request") => {
  if (!ok) {
    const e = Error(`exp.${code}`);
    e.status = 400;
    throw e;
  }
};
const category = (v) => {
  check(CATEGORIES.includes(v));
  return v;
};
const tier = (v) => {
  check(Number.isInteger(v) && v >= 0 && v <= 6);
  return v;
};
const integer = (v, max) => {
  check(Number.isSafeInteger(v) && v > 0 && v <= max);
  return v;
};
const count = async (db, id, cat) =>
  Number(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM collectible_instances WHERE user_id=? AND category=?",
        )
        .get(id, cat)
    ).n,
  );
async function room(db, id, cat, n) {
  check((await count(db, id, cat)) + n <= ITEM_CAPACITY, "capacity");
}
async function mint(db, id, cat, min, now) {
  const r = rarity(min),
    options = CATALOG.filter((d) => d.category === cat && d.rarity === r),
    d = options[randomInt(options.length)],
    instance = randomUUID();
  await db
    .prepare(
      "INSERT INTO collectible_instances(id,user_id,definition_id,category,rarity,created) VALUES(?,?,?,?,?,?)",
    )
    .run(instance, id, d.id, cat, r, now);
  return { id: instance, definitionId: d.id, rarity: r };
}
export async function scene(db, id) {
  const rows = await db
    .prepare(
      "SELECT * FROM collectible_instances WHERE user_id=? AND (equipped=1 OR x IS NOT NULL OR fish_id IN (SELECT id FROM player_fish WHERE user_id=? AND location='tank' ORDER BY ordinal,id LIMIT 240)) ORDER BY created,id LIMIT 1000",
    )
    .all(id, id);
  return {
    background: rows.find((i) => i.category === "background") || null,
    placements: rows.filter((i) => i.category === "decoration"),
    accessories: rows.filter((i) => i.category === "accessory"),
  };
}
function filters(id, p, eligible = false) {
  const where = ["user_id=?", "category=?"],
    args = [id, category(p.category)];
  if (p.tiers !== undefined) {
    check(Array.isArray(p.tiers) && p.tiers.length > 0 && p.tiers.length <= 7);
    p.tiers.forEach(tier);
    where.push(`rarity IN (${p.tiers.map(() => "?").join(",")})`);
    args.push(...p.tiers);
  }
  if (p.search) {
    check(typeof p.search === "string" && p.search.length <= 80);
    where.push("definition_id LIKE ? ESCAPE '\\'");
    args.push("%" + p.search.replace(/[\\%_]/g, "\\$&") + "%");
  }
  if (eligible) {
    where.push("locked=0", "equipped=0", "fish_id IS NULL", "x IS NULL");
  }
  if (p.ids !== undefined) {
    check(Array.isArray(p.ids) && p.ids.length > 0 && p.ids.length <= 500);
    check(p.ids.every((v) => typeof v === "string" && v.length <= 80));
    check(new Set(p.ids).size === p.ids.length);
    where.push(`id IN (${p.ids.map(() => "?").join(",")})`);
    args.push(...p.ids);
  }
  return { where: where.join(" AND "), args };
}
export async function inventory(db, id, p = {}) {
  const f = filters(id, p),
    page = Number(p.page || 1);
  integer(page, 2000);
  const sort = {
    newest: "created DESC,id",
    oldest: "created,id",
    tier: "rarity DESC,created,id",
    name: "definition_id,created,id",
  }[p.sort || "newest"];
  check(sort);
  const total = Number(
    (
      await db
        .prepare(
          `SELECT count(*) n FROM collectible_instances WHERE ${f.where}`,
        )
        .get(...f.args)
    ).n,
  );
  const rows = await db
    .prepare(
      `SELECT * FROM collectible_instances WHERE ${f.where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    )
    .all(...f.args, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const ef = filters(id, p, true);
  const eligibleTotal = Number(
    (
      await db
        .prepare(
          `SELECT count(*) n FROM collectible_instances WHERE ${ef.where}`,
        )
        .get(...ef.args)
    ).n,
  );
  const tickets = await db
    .prepare(
      "SELECT category,rarity,quantity FROM collectible_tickets WHERE user_id=? AND quantity>0 ORDER BY category,rarity",
    )
    .all(id);
  return {
    rows,
    total,
    eligibleTotal,
    page,
    pageSize: PAGE_SIZE,
    capacity: ITEM_CAPACITY,
    tickets,
  };
}
export async function preview(db, id, p, now) {
  check(["recycle", "delete"].includes(p.operation));
  const f = filters(id, p, true),
    token = randomUUID();
  await db
    .prepare("DELETE FROM inventory_previews WHERE user_id=? AND category=?")
    .run(id, p.category);
  const groups = await db
    .prepare(
      `SELECT rarity,count(*) n FROM collectible_instances WHERE ${f.where} GROUP BY rarity ORDER BY rarity`,
    )
    .all(...f.args);
  const summary = groups.map((g) => ({
    rarity: g.rarity,
    eligible: Number(g.n),
    consume:
      p.operation === "delete"
        ? Number(g.n)
        : Math.floor(Number(g.n) / 10) * 10,
    tickets: p.operation === "delete" ? 0 : Math.floor(Number(g.n) / 10),
    left: p.operation === "delete" ? 0 : Number(g.n) % 10,
  }));
  await db
    .prepare(
      "INSERT INTO inventory_previews(id,user_id,operation,category,created,summary) VALUES(?,?,?,?,?,?)",
    )
    .run(token, id, p.operation, p.category, now, JSON.stringify(summary));
  for (const group of summary)
    if (group.consume)
      await db
        .prepare(
          `INSERT INTO inventory_preview_rows(preview_id,instance_id,version) SELECT ?,id,version FROM collectible_instances WHERE ${f.where} AND rarity=? ORDER BY created,id LIMIT ?`,
        )
        .run(token, ...f.args, group.rarity, group.consume);
  return {
    id: token,
    summary,
    total: summary.reduce((n, g) => n + g.consume, 0),
    expires: now + 600000,
  };
}
async function commitPreview(db, id, p, now) {
  check(p.confirm === true, "confirmation");
  const v = await db
    .prepare("SELECT * FROM inventory_previews WHERE id=? AND user_id=?")
    .get(p.previewId, id);
  check(
    v &&
      CATEGORIES.includes(v.category) &&
      !v.consumed &&
      now - v.created <= 600000,
    "preview_expired",
  );
  const summary = JSON.parse(v.summary),
    n = summary.reduce((n, g) => n + g.consume, 0);
  const valid = Number(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM collectible_instances i JOIN inventory_preview_rows r ON r.instance_id=i.id WHERE r.preview_id=? AND i.user_id=? AND i.version=r.version AND i.locked=0 AND i.equipped=0 AND i.fish_id IS NULL AND i.x IS NULL",
        )
        .get(v.id, id)
    ).n,
  );
  check(valid === n, "selection_changed");
  await db
    .prepare(
      "INSERT INTO inventory_consumptions(preview_id,instance_id,user_id,category) SELECT preview_id,instance_id,?,? FROM inventory_preview_rows WHERE preview_id=?",
    )
    .run(id, v.category, v.id);
  await db
    .prepare("INSERT INTO audit(time,user_id,action,detail) VALUES(?,?,?,?)")
    .run(
      now,
      id,
      "inventoryConsumed",
      JSON.stringify({
        previewId: v.id,
        category: v.category,
        operation: v.operation,
        summary,
      }),
    );
  await db
    .prepare(
      "DELETE FROM collectible_instances WHERE user_id=? AND id IN (SELECT instance_id FROM inventory_preview_rows WHERE preview_id=?)",
    )
    .run(id, v.id);
  if (v.operation === "recycle")
    for (const g of summary)
      if (g.tickets)
        await db
          .prepare(
            "INSERT INTO collectible_tickets(user_id,category,rarity,quantity) VALUES(?,?,?,?) ON CONFLICT(user_id,category,rarity) DO UPDATE SET quantity=collectible_tickets.quantity+excluded.quantity",
          )
          .run(id, v.category, g.rarity, g.tickets);
  await db
    .prepare("UPDATE inventory_previews SET consumed=1 WHERE id=?")
    .run(v.id);
  return { summary, total: n };
}
export async function collectibleAction(db, id, type, p, s, now) {
  if (type === "itemGacha") {
    const cat = category(p.category);
    check([1, 10, 100].includes(p.count));
    await room(db, id, cat, p.count);
    const price = ITEM_ROLLS[p.count];
    check(s.pearls >= price, "pearls");
    s.pearls -= price;
    s.ledger.unshift({
      id: randomUUID(),
      delta: -price,
      reason: "exp.item_gacha",
      time: now,
    });
    const result = [];
    for (let i = 0; i < p.count; i++)
      result.push(await mint(db, id, cat, 0, now));
    s.lastItemRoll = result;
    return true;
  }
  if (type === "itemPreview") {
    s.itemPreview = await preview(db, id, p, now);
    return true;
  }
  if (type === "itemCommit") {
    s.itemOperation = await commitPreview(db, id, p, now);
    s.itemPreview = null;
    return true;
  }
  if (type === "itemTicket") {
    const cat = category(p.category),
      r = tier(p.rarity),
      n = integer(p.count, 1000);
    const ticket = await db
      .prepare(
        "SELECT quantity FROM collectible_tickets WHERE user_id=? AND category=? AND rarity=?",
      )
      .get(id, cat, r);
    check(ticket && ticket.quantity >= n, "ticket_missing");
    await room(db, id, cat, n);
    await db
      .prepare(
        "UPDATE collectible_tickets SET quantity=quantity-? WHERE user_id=? AND category=? AND rarity=?",
      )
      .run(n, id, cat, r);
    const result = [];
    for (let i = 0; i < n; i++) result.push(await mint(db, id, cat, r, now));
    s.lastItemRoll = result.slice(0, 100);
    s.itemOperation = { opened: n };
    return true;
  }
  if (
    ![
      "itemLock",
      "itemPlace",
      "itemRemove",
      "itemEquip",
      "itemUnequip",
    ].includes(type)
  )
    return false;
  const item = await db
    .prepare("SELECT * FROM collectible_instances WHERE id=? AND user_id=?")
    .get(p.id, id);
  check(item, "not_owned");
  if (type === "itemLock") {
    check(typeof p.locked === "boolean");
    await db
      .prepare(
        "UPDATE collectible_instances SET locked=?,version=version+1 WHERE id=?",
      )
      .run(p.locked ? 1 : 0, item.id);
    return true;
  }
  if (type === "itemPlace") {
    check(item.category === "decoration");
    check([p.x, p.y, p.rotation, p.scale].every(Number.isFinite));
    check(
      p.x >= 0.03 &&
        p.x <= 0.97 &&
        p.y >= 0.1 &&
        p.y <= 0.97 &&
        p.rotation >= -180 &&
        p.rotation <= 180 &&
        p.scale >= 0.4 &&
        p.scale <= 2.5,
    );
    const placed = Number(
      (
        await db
          .prepare(
            "SELECT count(*) n FROM collectible_instances WHERE user_id=? AND x IS NOT NULL",
          )
          .get(id)
      ).n,
    );
    check(item.x !== null || placed < MAX_PLACEMENTS, "placement_capacity");
    await db
      .prepare(
        "UPDATE collectible_instances SET x=?,y=?,rotation=?,scale=?,version=version+1 WHERE id=?",
      )
      .run(p.x, p.y, p.rotation, p.scale, item.id);
  } else if (type === "itemRemove") {
    check(item.category === "decoration");
    await db
      .prepare(
        "UPDATE collectible_instances SET x=NULL,y=NULL,rotation=NULL,scale=NULL,version=version+1 WHERE id=?",
      )
      .run(item.id);
  } else if (type === "itemUnequip") {
    await db
      .prepare(
        "UPDATE collectible_instances SET equipped=0,fish_id=NULL,slot=NULL,version=version+1 WHERE id=?",
      )
      .run(item.id);
  } else if (item.category === "background") {
    await db
      .prepare(
        "UPDATE collectible_instances SET equipped=0,version=version+1 WHERE user_id=? AND category='background' AND equipped=1",
      )
      .run(id);
    await db
      .prepare(
        "UPDATE collectible_instances SET equipped=1,version=version+1 WHERE id=?",
      )
      .run(item.id);
  } else {
    check(item.category === "accessory");
    const f = s.fish.find((f) => f.id === p.fishId);
    check(f, "not_owned");
    const slot = definition(item.definition_id).slot;
    await db
      .prepare(
        "UPDATE collectible_instances SET fish_id=NULL,slot=NULL,version=version+1 WHERE user_id=? AND fish_id=? AND slot=?",
      )
      .run(id, f.id, slot);
    await db
      .prepare(
        "UPDATE collectible_instances SET fish_id=?,slot=?,version=version+1 WHERE id=?",
      )
      .run(f.id, slot, item.id);
  }
  return true;
}
export async function detachAccessories(db, id, fishIds) {
  for (const fishId of fishIds)
    await db
      .prepare(
        "UPDATE collectible_instances SET fish_id=NULL,slot=NULL,version=version+1 WHERE user_id=? AND fish_id=?",
      )
      .run(id, fishId);
}
