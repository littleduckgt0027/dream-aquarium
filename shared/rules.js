export const RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
  "Celestial",
];
export const COLORS = [
  "#a7d4d1",
  "#65dd9b",
  "#5ebcff",
  "#bd89ff",
  "#ffcf74",
  "#ff8bbd",
  "#beffff",
];
export const ODDS = [60, 25, 10, 3.8, 1, 0.18, 0.02];
export const LIMITED = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5];
export const ROLLS = { 1: 100, 10: 900, 100: 8500, 1000: 80000 };
export const MARKET_UPGRADES = [
  4000, 8000, 16000, 32000, 64000, 100000, 140000, 180000, 252000,
];
export const MILESTONES = [24, 48, 100, 240];
export const BREED_MS = 120000;
export const TAX = 0.1;
export const monthKey = (time = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).format(time);
