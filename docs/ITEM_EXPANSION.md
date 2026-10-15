# Item gacha, inventory and recycling expansion

This expansion extends the existing game. It introduces no paid service, new secret, default wallet grant, new account or production deployment.

## Rules and ownership

The authoritative fish `ODDS` remain **60 / 25 / 10 / 3.8 / 1 / 0.18 / 0.02 percent**. All three collectible categories import this same array and use the existing cryptographic rarity sampler. No pity mechanism is added. Draw prices reuse the established fish economy: **100 / 900 / 8,500 Pearl for x1 / x10 / x100**. The backend chooses both rarity and design, checks capacity before charging, and records wallet/ownership/audit changes in the existing transaction and durable request-key boundary.

The catalog contains **42 original vector designs**: two designs per rarity per category. Artwork is rendered locally with Canvas; no external recordings, copyrighted image assets, uploads or object-storage service are involved. Rarity colors use the existing shared rules.

Each decoration/background/accessory is a distinct server-owned instance. There are **50,000 slots per category**. Equip one background; accessories occupy a head, face or body slot on an owned fish and cannot occupy two fish simultaneously. Replacing an occupied slot unequips its previous item. Trading, releasing or recycling a fish returns its accessories to inventory. A fish's DNA, generation, genes, ownership and breeding rules are unchanged.

The Aquarium Studio uses the existing persistent aquarium canvas. Place up to **60 decorations**; drag their markers with mouse/touch or use horizontal/vertical, rotation and size controls. Positions use normalized tank coordinates, rotation is -180–180 degrees and scale is 0.4–2.5. Remove/repositioning preserves ownership. Accessories render inside the existing fish transform, following position, direction and growth. Backgrounds are distinct underwater scenery with bounded effects. Fullscreen/background display, reduced motion and audio remain supported.

## Storage and pagination

Fish storage starts at its existing 120 slots. Paid upgrades retain the original price (`current capacity × 2 Pearl`) and increment of 120, with the last increment capped at **50,000**. Existing fish and balances are preserved; no free maximum storage is granted.

`player_fish` stores owned fish separately from the wallet/document. Existing document fish are moved transactionally on first access and marked `fishRows`; migration retains all original fish fields and IDs. The initial conversion reads the old document once. Normal production actions load only named fish; state responses contain at most 240 owned fish, while `/api/fish` returns pages of 48 with exact counts, rarity/name-or-ID/generation/location filters, age/rarity/name/generation ordering and maturity filters. Breeding, listing, feeding and accessory selectors also use server pages. Indexes support ownership, inventory order, rarity, maturity, name, location, protection and generation. The internal full collection reader remains available to tests/operator tooling; HTTP gameplay paths use bounded reads.

The legacy gacha retains x1/x10/x100/x1000 and its prices; results display the first 100 with the full draw count. Remaining fish are accessible through paginated storage. Offline state caches the bounded aquarium view. Legacy supplies are capped to 240 response entries, with all stacks accessible through the paginated Tickets & Supplies page. Food purchases are capped at 50,000 stored units; pre-existing excess supplies are retained.

## Safe selection and recycling

Fish Storage, Item Collection and Recycling Center support filtered selection, all eligible matches across every page, deselection, exact selection/preview counts, and confirmed bulk recycling/deletion. Multiple tier checkboxes allow per-tier selection. A dedicated all-category action previews and recycles complete groups in all four categories atomically.

Recycling always consumes complete groups of ten **within each category and rarity separately**. It leaves each tier's remainder untouched. Fish use their existing same-tier tickets and existing limited-fish/minimum-tier opening rules. Decorations, backgrounds and accessories produce their own same-tier recycling tickets; opening them uses the authoritative probability distribution conditioned on that tier or higher.

Before mutation, the server saves an expiring selection snapshot with exact IDs and versions/fish fingerprints. The confirmation shows eligible/consumed/remaining/ticket counts. Preview lifetime is ten minutes, with one current snapshot per category. A later preview invalidates the previous one. Changing selected ownership, locks, fish data, placement, equipment or breeding eligibility causes commit to fail without consuming anything. Consumed instance IDs and reward summaries remain in a permanent audit history after preview cleanup. Preview IDs are owner-scoped, single-use and survive process restart. Cross-category commits validate the exact preview identities and roll back every category on failure.

Locked fish, breeding parents, limited fish and unavailable/listed fish are excluded from bulk destruction. Locked, equipped and placed items are excluded from automatic consumption. Individual fish release retains explicit confirmation and now also respects its lock. All mutations use the existing database economy lock, transactions, audit trail and durable API idempotency keys.

Tickets & Supplies supports category/tier filters, all eligible stacks across pages, explicit quantities, lock/unlock, and confirmed bulk opening or permitted deletion. Food cannot be opened or recycled; tickets are not recursively recycled. Opening is bounded to 1,000 tickets per request to bound RNG/results, with all selected consumption/rewards atomic. Large recycling itself has no one-group limit; SQL snapshots/deletes avoid huge ID lists and parameter limits. The UI renders pages instead of entire inventories.

## Database and deployment

Additive migrations:

- `002_collectibles.sql`: unique collectible ownership, equipment, placement, ticket quantities/locks, durable previews and selected rows.
- `003_fish_inventory.sql`: normalized fish inventory, query indexes and fish snapshot fingerprints.

PostgreSQL startup runs registered migrations under the existing migration lock. SQLite local/Windows startup creates equivalent additive tables. First access transactionally normalizes each legacy player's fish; a failed conversion rolls back the document and rows together. Existing lineage, market listings, sessions, rewards, inventories and wallets are retained. SQLite-to-PostgreSQL import includes new tables when present, supports older sources without them, checks an empty destination and never overwrites the source.

**No new environment variables.** Continue using private Render `DATABASE_URL`, existing TLS/pool settings and GitHub repository variable `PRODUCTION_API_URL`. Build/review normally; do not merge or deploy automatically. Take the normal database backup before an owner-approved production rollout. Production Neon, transaction-pooler behavior and Render spin-down are not claimed tested without real credentials.

## Files and validation

New backend modules separate collectible rules/actions, fish persistence, fish bulk selection/tickets, stack transactions and all-category recycling. New frontend modules provide the item pages, original artwork, fish inventory/pickers, unified recycling and stack controls. Existing renderer/stage, localization, API, migration registration and import/packaging test fixtures are integrated rather than replaced. All new player labels, catalog names, previews, errors and controls have Thai/English/Simplified Chinese/Japanese/Korean entries; AST and dictionary/token parity tests check coverage.

Actual command results and remaining limits are recorded in [EXPANSION_VALIDATION.md](EXPANSION_VALIDATION.md). Screenshots show [equipped aquarium](expansion/aquarium.png) and [mobile inventory](expansion/mobile.png).
