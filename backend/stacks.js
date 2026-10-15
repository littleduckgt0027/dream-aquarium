import { randomUUID } from "node:crypto";
import { collectibleAction } from "./collectibles.js";
import { openFishTickets } from "./fish-tickets.js";
const check = (ok, code = "invalid_request") => {
  if (!ok) {
    const e = Error("exp." + code);
    e.status = 400;
    throw e;
  }
};
export async function stacks(db, id, s, p = {}) {
  const rows = s.items.map((i) => ({
    key: i.id,
    category: i.type === "ticket" ? "fish" : "food",
    rarity: i.rarity ?? 0,
    quantity: i.count,
    locked: i.locked || false,
  }));
  const tickets = await db
    .prepare(
      "SELECT * FROM collectible_tickets WHERE user_id=? AND quantity>0 ORDER BY category,rarity",
    )
    .all(id);
  rows.push(
    ...tickets.map((i) => ({
      key: `${i.category}:${i.rarity}`,
      category: i.category,
      rarity: i.rarity,
      quantity: i.quantity,
      locked: !!i.locked,
    })),
  );
  check(
    !p.category ||
      ["fish", "decoration", "background", "accessory", "food"].includes(
        p.category,
      ),
  );
  if (p.tiers)
    check(
      Array.isArray(p.tiers) &&
        p.tiers.length > 0 &&
        p.tiers.length <= 7 &&
        p.tiers.every((r) => Number.isInteger(r) && r >= 0 && r <= 6),
    );
  return rows.filter(
    (i) =>
      (!p.category || i.category === p.category) &&
      (!p.tiers || p.tiers.includes(i.rarity)),
  );
}
export async function stacksAction(db, id, type, p, s, now) {
  if (type === "stackLock") {
    check(typeof p.locked === "boolean");
    const item = s.items.find((i) => i.id === p.key);
    if (item) item.locked = p.locked;
    else {
      const tickets = await stacks(db, id, s);
      const entry = tickets.find((i) => i.key === p.key);
      check(entry);
      await db
        .prepare(
          "UPDATE collectible_tickets SET locked=? WHERE user_id=? AND category=? AND rarity=?",
        )
        .run(p.locked ? 1 : 0, id, entry.category, entry.rarity);
    }
    return true;
  }
  if (type === "stackPreview") {
    check(["open", "delete"].includes(p.operation));
    let rows = (await stacks(db, id, s, p)).filter(
      (i) => !i.locked && (p.operation !== "open" || i.category !== "food"),
    );
    if (p.quantities !== undefined) {
      check(
        Array.isArray(p.quantities) &&
          p.quantities.length > 0 &&
          p.quantities.length <= 500 &&
          new Set(p.quantities.map((i) => i.key)).size === p.quantities.length,
      );
      rows = p.quantities.map((q) => {
        const i = rows.find((i) => i.key === q.key);
        check(
          i &&
            Number.isSafeInteger(q.quantity) &&
            q.quantity > 0 &&
            q.quantity <= i.quantity,
        );
        return { ...i, quantity: q.quantity };
      });
    }
    const total = rows.reduce((n, i) => n + i.quantity, 0);
    check(p.operation !== "open" || total <= 1000, "open_limit");
    const preview = { id: randomUUID(), rows, total, operation: p.operation };
    await db
      .prepare(
        "DELETE FROM inventory_previews WHERE user_id=? AND category='stacks'",
      )
      .run(id);
    await db
      .prepare(
        "INSERT INTO inventory_previews(id,user_id,operation,category,created,summary) VALUES(?,?,?,?,?,?)",
      )
      .run(preview.id, id, p.operation, "stacks", now, JSON.stringify(preview));
    s.stackPreview = {
      ...preview,
      rows: preview.rows.slice(0, 48),
      rowCount: preview.rows.length,
    };
    return true;
  }
  if (type !== "stackCommit") return false;
  check(p.confirm === true, "confirmation");
  const v = await db
    .prepare(
      "SELECT * FROM inventory_previews WHERE id=? AND user_id=? AND category='stacks'",
    )
    .get(p.previewId, id);
  check(v && !v.consumed && now - v.created <= 600000, "preview_expired");
  const preview = JSON.parse(v.summary),
    current = await stacks(db, id, s);
  check(
    preview.rows.every((row) => {
      const i = current.find((i) => i.key === row.key);
      return i && !i.locked && i.quantity >= row.quantity;
    }),
    "selection_changed",
  );
  for (const row of preview.rows) {
    if (preview.operation === "open") {
      if (row.category === "fish")
        openFishTickets(s, row.key, row.quantity, now);
      else
        await collectibleAction(
          db,
          id,
          "itemTicket",
          { category: row.category, rarity: row.rarity, count: row.quantity },
          s,
          now,
        );
    } else if (["fish", "food"].includes(row.category)) {
      const item = s.items.find((i) => i.id === row.key);
      item.count -= row.quantity;
      s.items = s.items.filter((i) => i.count > 0);
    } else
      await db
        .prepare(
          "UPDATE collectible_tickets SET quantity=quantity-? WHERE user_id=? AND category=? AND rarity=?",
        )
        .run(row.quantity, id, row.category, row.rarity);
  }
  await db
    .prepare("INSERT INTO audit(time,user_id,action,detail) VALUES(?,?,?,?)")
    .run(now, id, "inventoryConsumed", JSON.stringify(preview));
  await db
    .prepare("UPDATE inventory_previews SET consumed=1 WHERE id=?")
    .run(v.id);
  s.stackPreview = null;
  s.itemOperation = { total: preview.total };
  return true;
}
