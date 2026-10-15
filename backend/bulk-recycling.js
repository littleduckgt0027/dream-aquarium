import { fishBulkAction } from "./fish-bulk.js";
import { collectibleAction } from "./collectibles.js";
export async function bulkRecycling(db, id, type, p, s, now) {
  if (type === "recycleAllPreview") {
    const previews = [];
    await fishBulkAction(
      db,
      id,
      "fishPreview",
      { operation: "recycle", tiers: p.tiers },
      s,
      now,
    );
    previews.push({ category: "fish", ...s.itemPreview });
    for (const category of ["decoration", "background", "accessory"]) {
      await collectibleAction(
        db,
        id,
        "itemPreview",
        { operation: "recycle", category, tiers: p.tiers },
        s,
        now,
      );
      previews.push({ category, ...s.itemPreview });
    }
    s.bulkPreviews = previews;
    s.itemPreview = null;
    return true;
  }
  if (type !== "recycleAllCommit") return false;
  if (
    p.confirm !== true ||
    !s.bulkPreviews ||
    JSON.stringify(p.previewIds) !==
      JSON.stringify(s.bulkPreviews.map((v) => v.id))
  ) {
    const e = Error("exp.confirmation");
    e.status = 400;
    throw e;
  }
  for (const v of s.bulkPreviews) {
    if (v.category === "fish")
      await fishBulkAction(
        db,
        id,
        "fishCommit",
        { previewId: v.id, confirm: true },
        s,
        now,
      );
    else
      await collectibleAction(
        db,
        id,
        "itemCommit",
        { previewId: v.id, confirm: true },
        s,
        now,
      );
  }
  s.bulkPreviews = null;
  return true;
}
