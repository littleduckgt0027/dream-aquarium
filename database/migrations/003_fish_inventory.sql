CREATE TABLE player_fish (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 rarity INTEGER NOT NULL, name TEXT NOT NULL, generation INTEGER NOT NULL,
 location TEXT NOT NULL, limited TEXT, locked INTEGER NOT NULL DEFAULT 0,
 born BIGINT NOT NULL, mature_at BIGINT NOT NULL, ordinal BIGINT NOT NULL, breeding INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL
);
CREATE INDEX fish_inventory_page ON player_fish(user_id,location,rarity,id);
CREATE INDEX fish_inventory_name ON player_fish(user_id,name,id);
CREATE INDEX fish_inventory_generation ON player_fish(user_id,generation,id);

ALTER TABLE inventory_preview_rows ADD COLUMN fingerprint TEXT;
CREATE INDEX fish_inventory_maturity ON player_fish(user_id,mature_at,id);
CREATE INDEX fish_inventory_order ON player_fish(user_id,ordinal,id);
CREATE INDEX fish_inventory_location_order ON player_fish(user_id,location,ordinal,id);
CREATE INDEX fish_inventory_rarity ON player_fish(user_id,rarity DESC,id);
CREATE INDEX fish_inventory_protection ON player_fish(user_id,breeding,locked,limited,rarity,ordinal);
