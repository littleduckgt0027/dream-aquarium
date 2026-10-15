import { randomInt, randomUUID } from "node:crypto";
import { ODDS, monthKey } from "../shared/rules.js";
export const rand = () => randomInt(0, 1000000) / 1000000;
export function rarity(min = 0) {
  let x = rand() * ODDS.slice(min).reduce((a, b) => a + b, 0);
  for (let i = min; i < ODDS.length; i++) {
    x -= ODDS[i];
    if (x < 0) return i;
  }
  return 6;
}
export function dna() {
  return {
    body: rand(),
    proportion: rand(),
    head: rand(),
    tail: randomInt(4),
    tailLength: rand(),
    fin: randomInt(3),
    finLength: rand(),
    hue: randomInt(360),
    accent: randomInt(360),
    pattern: randomInt(4),
    eye: rand(),
    growth: 0.65 + rand() * 0.7,
    maxSize: 0.8 + rand() * 0.8,
    mutation: rand() < 0.03,
    glow: rand() < 0.08,
    fertility: rand(),
  };
}
export function fish({
  tier = rarity(),
  parents = [],
  genes = dna(),
  generation = 0,
  limited = null,
  mature = false,
  now = Date.now(),
} = {}) {
  return {
    id: randomUUID(),
    name: [
      "Ripple",
      "Coral",
      "Luna",
      "Azure",
      "Mango",
      "Opal",
      "Nimbus",
      "Koi",
    ][randomInt(8)],
    rarity: tier,
    dna: genes,
    born: now - (mature ? 172800000 : 0),
    parents,
    generation,
    location: "storage",
    limited,
  };
}
export function offspring(a, b, now) {
  const genes = {};
  for (const key of Object.keys(a.dna))
    genes[key] = rand() < 0.5 ? a.dna[key] : b.dna[key];
  if (rand() < 0.08) {
    genes.hue = randomInt(360);
    genes.mutation = true;
  }
  return fish({
    tier: Math.max(
      0,
      Math.min(
        6,
        Math.round((a.rarity + b.rarity) / 2) + (rand() < 0.05 ? 1 : 0),
      ),
    ),
    genes,
    parents: [a.id, b.id],
    generation: Math.max(a.generation, b.generation) + 1,
    now,
  });
}
export function growth(f, now = Date.now()) {
  return Math.min(
    1,
    Math.max(0, (now - f.born + (f.boost || 0)) / (86400000 * f.dna.growth)),
  );
}
export function historicalMonths(now = Date.now()) {
  const current = monthKey(now);
  let y = 2026,
    m = 1;
  const out = [];
  while (`${y}-${String(m).padStart(2, "0")}` < current) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
