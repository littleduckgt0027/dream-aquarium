-- Additive, independent ownership; existing wallets, fish and inventories remain intact.
CREATE TABLE collectible_instances (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 definition_id TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('decoration','background','accessory')),
 rarity INTEGER NOT NULL CHECK(rarity BETWEEN 0 AND 6),
 locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)), version INTEGER NOT NULL DEFAULT 0,
 fish_id TEXT, slot TEXT, equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),
 x REAL, y REAL, rotation REAL, scale REAL, created BIGINT NOT NULL
);
CREATE INDEX collectibles_inventory ON collectible_instances(user_id,category,rarity,created,id);
CREATE INDEX collectibles_fish ON collectible_instances(user_id,fish_id);
CREATE UNIQUE INDEX collectibles_slot ON collectible_instances(user_id,fish_id,slot) WHERE fish_id IS NOT NULL;
CREATE UNIQUE INDEX collectibles_background ON collectible_instances(user_id) WHERE category='background' AND equipped=1;
CREATE TABLE collectible_tickets (
 user_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL CHECK(category IN ('decoration','background','accessory')),
 rarity INTEGER NOT NULL CHECK(rarity BETWEEN 0 AND 6), locked INTEGER NOT NULL DEFAULT 0, quantity INTEGER NOT NULL CHECK(quantity>=0),
 PRIMARY KEY(user_id,category,rarity)
);
CREATE TABLE inventory_previews (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), operation TEXT NOT NULL,
 category TEXT NOT NULL, created BIGINT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0,
 summary TEXT NOT NULL
);
CREATE TABLE inventory_preview_rows (
 preview_id TEXT NOT NULL REFERENCES inventory_previews(id) ON DELETE CASCADE,
 instance_id TEXT NOT NULL, version INTEGER NOT NULL,
 PRIMARY KEY(preview_id,instance_id)
);
CREATE INDEX inventory_previews_owner ON inventory_previews(user_id,created);
-- Compact permanent consumption history survives expired-preview cleanup.
CREATE TABLE inventory_consumptions (
 preview_id TEXT NOT NULL, instance_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL,
 PRIMARY KEY(preview_id,instance_id)
);
CREATE INDEX inventory_consumptions_owner ON inventory_consumptions(user_id,preview_id);
