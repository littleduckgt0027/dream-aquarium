import { randomInt } from "node:crypto";
import { fish, rarity, rand, historicalMonths } from "./genetics.js";
import { LIMITED, monthKey } from "../shared/rules.js";
import { storageCount } from "./fish-store.js";
export function openFishTickets(s, id, count, now) {
  const t = s.items.find((t) => t.id === id && t.type === "ticket");
  const check = (ok, code) => {
    if (!ok) {
      const e = Error(code);
      e.status = 400;
      throw e;
    }
  };
  check(t, "Ticket missing");
  check(
    Number.isInteger(count) && count > 0 && count <= 1000 && count <= t.count,
    "exp.ticket_missing",
  );
  check(
    storageCount(s) + count <= s.storage,
    "Storage full. Upgrade storage or free a slot. Inbox deliveries never expire.",
  );
  for (let at = 0; at < count; at++) {
    let f;
    if (rand() * 100 < LIMITED[t.rarity]) {
      const history = historicalMonths(now),
        limited = history.length
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
    } else f = fish({ tier: rarity(t.rarity), now });
    s.fish.push(f);
  }
  t.count -= count;
  s.items = s.items.filter((i) => i.count > 0);
}
