import { randomUUID } from "node:crypto";
export function addStack(items, type, count) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw Error("Invalid item quantity");
  for (const item of items.filter(
    (i) => i.type === type && i.stackable && i.count < 999,
  )) {
    const n = Math.min(count, 999 - item.count);
    item.count += n;
    count -= n;
    if (!count) return;
  }
  while (count) {
    const n = Math.min(count, 999);
    items.push({
      id: randomUUID(),
      type,
      count: n,
      stackable: true,
      tradable: false,
    });
    count -= n;
  }
}
export function consume(items, id) {
  const item = items.find((i) => i.id === id);
  if (!item || item.count < 1) throw Error("Item unavailable");
  item.count--;
  return items.filter((i) => i.count > 0);
}
