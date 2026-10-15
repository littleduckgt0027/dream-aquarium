import { transaction } from "./db.js";
import { addStack, consume } from "./inventory.js";
import { randomUUID, randomInt } from "node:crypto";
import {
  fish,
  offspring,
  growth,
  historicalMonths,
  rand,
  rarity,
} from "./genetics.js";
import {
  RARITIES,
  LIMITED,
  ROLLS,
  MARKET_UPGRADES,
  MILESTONES,
  BREED_MS,
  TAX,
  monthKey,
} from "../shared/rules.js";
export function requireThat(condition, message) {
  if (!condition) {
    const e = new Error(message);
    e.status = 400;
    throw e;
  }
}
const amount = (v) => {
  requireThat(
    Number.isSafeInteger(v) && v > 0 && v <= 1000000000,
    "Enter a positive whole-number amount (maximum 1 billion)",
  );
  return v;
};
export function initialState(now = Date.now()) {
  return {
    pearls: 3000,
    fish: Array.from({ length: 5 }, (_, i) => ({
      ...fish({ tier: i < 3 ? 0 : 1, mature: true, now }),
      location: "tank",
    })),
    tank: 12,
    storage: 120,
    marketLevel: 0,
    theme: "lagoon",
    decorations: ["garden"],
    items: [],
    breeds: [],
    rewards: [],
    deliveries: [],
    ledger: [],
    sales: [],
    collection: [],
    online: {
      month: monthKey(now),
      seconds: 0,
      total: 0,
      last: 0,
      pearlSteps: 0,
      milestones: [],
    },
    created: now,
  };
}
export async function load(db, id) {
  const r = await db.prepare("SELECT state FROM users WHERE id=?").get(id);
  requireThat(r, "Player not found");
  return JSON.parse(r.state);
}
export async function save(db, id, s) {
  return transaction(db, async () => {
    const fish = [...s.fish, ...s.breeds.flatMap((b) => b.children)];
    for (let at = 0; at < fish.length; at += 250) {
      const batch = fish.slice(at, at + 250);
      await db
        .prepare(
          "INSERT OR IGNORE INTO lineage VALUES" +
            batch.map(() => "(?,?)").join(","),
        )
        .run(...batch.flatMap((f) => [f.id, JSON.stringify(f)]));
    }
    await db
      .prepare("UPDATE users SET state=? WHERE id=?")
      .run(JSON.stringify(s), id);
  });
}
export function ledger(s, delta, reason, now) {
  requireThat(
    Number.isSafeInteger(delta) && s.pearls + delta >= 0,
    "Not enough Pearl",
  );
  s.pearls += delta;
  s.ledger.unshift({ id: randomUUID(), delta, reason, time: now });
}
function owned(s, id) {
  const f = s.fish.find((f) => f.id === id);
  requireThat(f, "Fish not found or not owned");
  return f;
}
function delivery(s, f, reason, now) {
  s.deliveries.unshift({
    id: randomUUID(),
    fish: f,
    reason,
    time: now,
    claimed: false,
  });
}
function reward(s, kind, value, now, selection = false) {
  s.rewards.unshift({
    id: randomUUID(),
    kind,
    value,
    time: now,
    claimed: false,
    selection,
  });
}
function room(s, n = 1) {
  requireThat(
    s.fish.filter((f) => f.location === "storage").length + n <= s.storage,
    "Storage full. Upgrade storage or free a slot. Inbox deliveries never expire.",
  );
}
function addFish(s, fs) {
  room(s, fs.length);
  s.fish.push(...fs);
}
export async function settle(db, now = Date.now()) {
  return transaction(db, async () => {
    const rows = await db
      .prepare(
        "SELECT * FROM listings WHERE status='open' AND type='auction' AND end_at<=?",
      )
      .all(now);
    for (const l of rows) {
      if (l.bidder) await completeSale(db, l, l.bidder, l.bid, now, true);
      else {
        const seller = await load(db, l.seller);
        delivery(seller, JSON.parse(l.fish), "Expired auction", now);
        await save(db, l.seller, seller);
        await db
          .prepare(
            "UPDATE listings SET status='expired' WHERE id=? AND status='open'",
          )
          .run(l.id);
      }
    }
  });
}
async function completeSale(db, l, buyer, price, now, escrow = false) {
  requireThat(l.status === "open", "Listing already sold");
  requireThat(l.seller !== buyer, "Cannot buy your own fish");
  const b = await load(db, buyer),
    s = await load(db, l.seller);
  if (!escrow) {
    if (l.bidder === buyer)
      ledger(b, l.bid, "Auction escrow applied to buyout", now);
    ledger(b, -price, "Marketplace purchase", now);
  }
  const tax = Math.floor(price * TAX);
  ledger(s, price - tax, "Marketplace sale (10% tax)", now);
  delivery(b, JSON.parse(l.fish), "Marketplace purchase", now);
  const sale = {
    id: l.id,
    price,
    tax,
    buyer,
    seller: l.seller,
    time: now,
    fish: JSON.parse(l.fish).name,
  };
  b.sales.unshift(sale);
  s.sales.unshift(sale);
  if (l.bidder && !escrow && l.bidder !== buyer) {
    const refund = l.bidder === buyer ? b : await load(db, l.bidder);
    ledger(refund, l.bid, "Auction bid refund", now);
    if (l.bidder !== buyer) await save(db, l.bidder, refund);
  }
  await save(db, buyer, b);
  await save(db, l.seller, s);
  await db
    .prepare("UPDATE listings SET status='sold' WHERE id=? AND status='open'")
    .run(l.id);
}
export async function publicState(db, id, now = Date.now()) {
  const s = await load(db, id);
  return {
    ...s,
    fish: s.fish.map((f) => ({ ...f, growth: growth(f, now) })),
    id,
    username: (
      await db.prepare("SELECT username FROM users WHERE id=?").get(id)
    ).username,
    serverTime: now,
    maintenanceSince: Number(
      (await db.prepare("SELECT value FROM meta WHERE key='maintenance'").get())
        .value,
    ),
    month: monthKey(now),
    historicalMonths: historicalMonths(now),
    maintenance:
      (await db.prepare("SELECT value FROM meta WHERE key='maintenance'").get())
        .value !== "0",
    listings: (
      await db
        .prepare(
          "SELECT l.*,u.username seller_name FROM listings l JOIN users u ON l.seller=u.id WHERE l.status='open' ORDER BY l.rowid DESC LIMIT 200",
        )
        .all()
    ).map((l) => ({
      ...l,
      fish: {
        ...JSON.parse(l.fish),
        growth: growth(JSON.parse(l.fish), now),
      },
    })),
  };
}
export function heartbeat(s, now) {
  const o = s.online;
  const month = monthKey(now);
  // Only continuously observed intervals up to 45 seconds count. No offline or fabricated grace credit.
  if (o.month !== month) {
    o.month = month;
    o.seconds = 0;
    o.milestones = [];
    o.last = 0;
  }
  const elapsed = o.last ? Math.max(0, (now - o.last) / 1000) : 0;
  if (elapsed <= 45) {
    o.seconds += elapsed;
    o.total += elapsed;
  }
  o.last = now;
  const steps = Math.floor(o.total / 10800);
  while (o.pearlSteps < steps) {
    o.pearlSteps++;
    reward(s, "pearl", 300, now);
  }
  for (const h of MILESTONES)
    if (o.seconds >= h * 3600 && !o.milestones.includes(h)) {
      o.milestones.push(h);
      reward(s, "limited", month, now, true);
    }
}
export async function action(db, id, type, p = {}, now = Date.now()) {
  return transaction(db, async () => {
    let s = await load(db, id);
    if (type === "heartbeat") {
      heartbeat(s, now);
    } else if (type === "move") {
      const f = owned(s, p.id);
      requireThat(["tank", "storage"].includes(p.location), "Invalid location");
      if (f.location !== p.location) {
        if (p.location === "tank")
          requireThat(
            s.fish.filter((f) => f.location === "tank").length < s.tank,
            "Aquarium is full",
          );
        else room(s);
        f.location = p.location;
      }
    } else if (type === "release") {
      requireThat(p.confirm === true, "Confirm permanent release");
      const f = owned(s, p.id);
      requireThat(
        !s.breeds.some((b) => !b.claimed && b.parents.includes(f.id)),
        "Parent is breeding",
      );
      s.fish = s.fish.filter((x) => x.id !== f.id);
    } else if (type === "upgrade") {
      if (p.kind === "tank") {
        ledger(s, -s.tank * 100, "Aquarium expansion", now);
        s.tank += 6;
      } else if (p.kind === "storage") {
        requireThat(s.storage < 10000, "Maximum storage reached");
        ledger(s, -Math.floor(s.storage * 2), "Storage expansion", now);
        s.storage = Math.min(10000, s.storage + 120);
      } else {
        requireThat(
          p.kind === "market" && s.marketLevel < 9,
          "Maximum marketplace slots reached",
        );
        ledger(
          s,
          -MARKET_UPGRADES[s.marketLevel],
          "Marketplace expansion",
          now,
        );
        s.marketLevel++;
      }
    } else if (type === "decorate") {
      requireThat(
        ["lagoon", "midnight", "coral"].includes(p.theme),
        "Unknown environment",
      );
      requireThat(
        ["garden", "ruins", "minimal"].includes(p.decor),
        "Unknown decoration",
      );
      s.theme = p.theme;
      s.decorations = [p.decor];
    } else if (type === "gacha") {
      requireThat([1, 10, 100, 1000].includes(p.count), "Invalid roll count");
      room(s, p.count);
      ledger(s, -ROLLS[p.count], `Gacha x${p.count}`, now);
      const result = Array.from({ length: p.count }, () => fish({ now }));
      s.fish.push(...result);
      s.lastRoll = result.map((f) => f.id);
    } else if (type === "breed") {
      requireThat(p.a !== p.b, "Choose two different parents");
      const a = owned(s, p.a),
        b = owned(s, p.b);
      requireThat(
        growth(a, now) >= 1 && growth(b, now) >= 1,
        "Both parents must be mature",
      );
      requireThat(
        !s.breeds.some(
          (j) =>
            !j.claimed &&
            (j.parents.includes(a.id) || j.parents.includes(b.id)),
        ),
        "A parent is already breeding",
      );
      ledger(s, -200, "Breeding", now);
      const count =
        1 + (rand() < (a.dna.fertility + b.dna.fertility) / 4 ? 1 : 0);
      s.breeds.push({
        id: randomUUID(),
        parents: [a.id, b.id],
        ready: now + BREED_MS,
        children: Array.from({ length: count }, () =>
          offspring(a, b, now + BREED_MS),
        ),
        claimed: false,
      });
    } else if (type === "breedClaim") {
      const j = s.breeds.find((j) => j.id === p.id);
      requireThat(j && !j.claimed && now >= j.ready, "Breeding is not ready");
      room(s, j.children.length);
      j.claimed = true;
      s.fish.push(...j.children);
    } else if (type === "recycle") {
      requireThat(
        Array.isArray(p.ids) &&
          p.ids.length === 10 &&
          new Set(p.ids).size === 10,
        "Select exactly 10 different fish",
      );
      const fs = p.ids.map((id) => owned(s, id));
      requireThat(
        fs.every((f) => f.rarity === fs[0].rarity && !f.limited),
        "Select 10 non-limited fish of the same rarity",
      );
      requireThat(
        fs.every(
          (f) => !s.breeds.some((j) => !j.claimed && j.parents.includes(f.id)),
        ),
        "Breeding parents cannot be recycled",
      );
      s.fish = s.fish.filter((f) => !p.ids.includes(f.id));
      s.items.push({
        id: randomUUID(),
        type: "ticket",
        rarity: fs[0].rarity,
        count: 1,
        tradable: false,
      });
    } else if (type === "buyFood") {
      requireThat(
        Number.isInteger(p.count) && p.count > 0 && p.count <= 9999,
        "Choose 1–9999 food",
      );
      ledger(s, -p.count * 20, "Fish food", now);
      addStack(s.items, "food", p.count);
    } else if (type === "feed") {
      const f = owned(s, p.fishId);
      const item = s.items.find((i) => i.id === p.id && i.type === "food");
      requireThat(item, "Fish food unavailable");
      requireThat(growth(f, now) < 1, "This fish is already mature");
      s.items = consume(s.items, item.id);
      f.boost = (f.boost || 0) + 3600000;
    } else if (type === "ticket") {
      const t = s.items.find((t) => t.id === p.id && t.type === "ticket");
      requireThat(t, "Ticket missing");
      room(s);
      let f;
      if (rand() * 100 < LIMITED[t.rarity]) {
        const history = historicalMonths(now);
        const limited = history.length
          ? history[randomInt(history.length)]
          : monthKey(now);
        f = fish({ tier: t.rarity, limited, now });
        const variant = rand() < 0.5 ? "sunrise" : "moonlight";
        f.dna.hue = variant === "sunrise" ? 35 : 210;
        s.collection.push({
          fishId: f.id,
          month: limited,
          rarity: f.rarity,
          variant,
        });
      } else {
        f = fish({ tier: rarity(t.rarity), now });
      }
      s.fish.push(f);
      s.items = s.items.filter((i) => i.id !== p.id);
    } else if (type === "list") {
      const f = owned(s, p.id);
      requireThat(
        !s.breeds.some((j) => !j.claimed && j.parents.includes(f.id)),
        "Fish is breeding",
      );
      amount(p.price);
      requireThat(
        ["fixed", "auction"].includes(p.type),
        "Invalid listing type",
      );
      requireThat(
        (
          await db
            .prepare(
              "SELECT count(*) n FROM listings WHERE seller=? AND status='open'",
            )
            .get(id)
        ).n <
          10 + s.marketLevel * 10,
        "Marketplace slots full",
      );
      if (p.type === "auction")
        requireThat(
          [6, 12, 24, 48].includes(p.hours),
          "Choose 6, 12, 24 or 48 hours",
        );
      if (p.buyout != null) {
        amount(p.buyout);
        requireThat(
          p.buyout >= p.price,
          "Buyout must be at least starting price",
        );
      }
      await db
        .prepare(
          "INSERT INTO listings(id,seller,fish,type,price,buyout,end_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          id,
          JSON.stringify(f),
          p.type,
          p.price,
          p.buyout || null,
          p.type === "auction" ? now + p.hours * 3600000 : null,
        );
      s.fish = s.fish.filter((x) => x.id !== f.id);
    } else if (type === "cancel") {
      const l = await db.prepare("SELECT * FROM listings WHERE id=?").get(p.id);
      requireThat(
        l && l.seller === id && l.status === "open" && !l.bidder,
        "Cannot cancel listing with bids or completed sale",
      );
      delivery(s, JSON.parse(l.fish), "Cancelled listing", now);
      await db
        .prepare("UPDATE listings SET status='cancelled' WHERE id=?")
        .run(l.id);
    } else if (type === "buy" || type === "bid") {
      const l = await db.prepare("SELECT * FROM listings WHERE id=?").get(p.id);
      requireThat(l && l.status === "open", "Listing unavailable");
      requireThat(l.seller !== id, "Cannot trade with yourself");
      if (type === "buy") {
        requireThat(
          l.type === "fixed" || l.buyout,
          "No buyout on this auction",
        );
        await save(db, id, s);
        await completeSale(
          db,
          l,
          id,
          l.type === "fixed" ? l.price : l.buyout,
          now,
        );
        s = await load(db, id);
      } else {
        requireThat(l.type === "auction" && l.end_at > now, "Auction ended");
        amount(p.amount);
        requireThat(p.amount >= Math.max(l.price, l.bid + 1), "Bid is too low");
        if (l.buyout)
          requireThat(p.amount < l.buyout, "Use Buyout for this amount");
        if (l.bidder === id)
          ledger(s, l.bid, "Existing bid escrow reapplied", now);
        ledger(s, -p.amount, "Auction escrow", now);
        if (l.bidder && l.bidder !== id) {
          const old = await load(db, l.bidder);
          ledger(old, l.bid, "Outbid refund", now);
          await save(db, l.bidder, old);
        }
        await db
          .prepare("UPDATE listings SET bid=?,bidder=? WHERE id=?")
          .run(p.amount, id, l.id);
      }
    } else if (type === "delivery") {
      const entries = p.all
        ? s.deliveries.filter((d) => !d.claimed)
        : s.deliveries.filter((d) => d.id === p.id && !d.claimed);
      requireThat(entries.length, "No unclaimed deliveries");
      room(s, entries.length);
      for (const d of entries) {
        d.claimed = true;
        s.fish.push({ ...d.fish, location: "storage" });
      }
    } else if (type === "reward") {
      const entries = p.all
        ? s.rewards.filter((r) => !r.claimed && !r.selection)
        : s.rewards.filter((r) => r.id === p.id && !r.claimed);
      requireThat(
        entries.length,
        "No eligible rewards (select a variant individually for Limited rewards)",
      );
      for (const r of entries) {
        if (r.selection)
          requireThat(
            ["sunrise", "moonlight"].includes(p.selection),
            "Choose sunrise or moonlight",
          );
        if (r.kind === "pearl") ledger(s, r.value, "Online reward", now);
        else {
          const f = fish({ tier: 4, limited: r.value, now });
          f.dna.hue = p.selection === "sunrise" ? 35 : 210;
          delivery(s, f, `Limited ${r.value}`, now);
          s.collection.push({
            fishId: f.id,
            month: r.value,
            rarity: f.rarity,
            variant: p.selection,
          });
        }
        r.claimed = true;
        r.claimedAt = now;
      }
    } else requireThat(false, "Unknown action");
    await save(db, id, s);
    await db
      .prepare("INSERT INTO audit(time,user_id,action,detail) VALUES(?,?,?,?)")
      .run(now, id, type, JSON.stringify(p));
    return await publicState(db, id, now);
  });
}
export async function setMaintenance(db, on, now = Date.now()) {
  return transaction(db, async () => {
    const value = (
      await db.prepare("SELECT value FROM meta WHERE key='maintenance'").get()
    ).value;
    if (on && value === "0") {
      await settle(db, now);
      await db
        .prepare("UPDATE meta SET value=? WHERE key='maintenance'")
        .run(String(now));
      for (const u of await db.prepare("SELECT id,state FROM users").all()) {
        const s = JSON.parse(u.state);
        s.online.last = 0;
        await save(db, u.id, s);
      }
    }
    if (!on && value !== "0") {
      await db
        .prepare(
          "UPDATE listings SET end_at=end_at+? WHERE type='auction' AND status='open'",
        )
        .run(Math.max(0, now - Number(value)));
      await db
        .prepare("UPDATE meta SET value='0' WHERE key='maintenance'")
        .run();
    }
  });
}
