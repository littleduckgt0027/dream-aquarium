import { ODDS, ROLLS } from "./rules.js";
export { ODDS };
export const CATEGORIES = ["decoration", "background", "accessory"];
export const ITEM_CAPACITY = 50000;
export const MAX_PLACEMENTS = 60;
export const FISH_STORAGE_MAX = 50000;
export const PAGE_SIZE = 48;
export const ITEM_ROLLS = Object.freeze({
  1: ROLLS[1],
  10: ROLLS[10],
  100: ROLLS[100],
});
const motifs = {
  decoration: [
    "pebble",
    "reed",
    "coral",
    "fern",
    "chest",
    "arch",
    "wreck",
    "statue",
    "castle",
    "crystal",
    "dragon",
    "relic",
    "portal",
    "throne",
  ],
  background: [
    "lagoon",
    "sandbank",
    "reef",
    "kelp",
    "cave",
    "trench",
    "temple",
    "grotto",
    "city",
    "aurora",
    "nebula",
    "abyss",
    "cosmos",
    "elysium",
  ],
  accessory: [
    "cap",
    "bow",
    "glasses",
    "ribbon",
    "helmet",
    "necklace",
    "crown",
    "mask",
    "antlers",
    "armor",
    "halo",
    "wings",
    "comet",
    "galaxy",
  ],
};
export const CATALOG = Object.freeze(
  CATEGORIES.flatMap((category) =>
    motifs[category].map((motif, i) =>
      Object.freeze({
        id: `${category}_${motif}`,
        category,
        motif,
        rarity: Math.floor(i / 2),
        variant: i % 2,
        slot:
          category === "accessory"
            ? [
                "head",
                "body",
                "face",
                "body",
                "head",
                "body",
                "head",
                "face",
                "head",
                "body",
                "head",
                "body",
                "head",
                "body",
              ][i]
            : null,
        hue:
          (i * 37 +
            { decoration: 110, background: 174, accessory: 25 }[category]) %
          360,
      }),
    ),
  ),
);
export const definition = (id) => CATALOG.find((item) => item.id === id);
