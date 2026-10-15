# Item expansion validation

Validated locally on 16 October 2026 (Asia/Bangkok), Node 24.19.0, Chromium 154/Linux and disposable PostgreSQL 17.11 schemas. No real Neon connection string, production account or production deployment was used.

| Check | Actual result |
| --- | --- |
| `TEST_DATABASE_URL=… npm test` | 66 passed, no failures/skips |
| `npm test` with local SQLite fixtures | 57 passed, 9 explicit PostgreSQL/admin integration skips |
| `TEST_DATABASE_URL=… npm run test:postgres` | 52 passed, no failures/skips |
| `npm run test:e2e` | 3 passed: full breeding/management/offline journey, multi-account trade/auction, real operator maintenance |
| `TEST_DATABASE_URL=… npm run test:pages` | 11 passed, including 2 new expansion journeys plus all localization/audio/immersive/Pages regressions |
| Production build | Passed; approximately 494 kB JS raw / 148 kB gzip; original vector artwork, no new production dependency |
| Docker production image | Built successfully with the normal Dockerfile and verified CA trust |
| Docker TLS smoke and actual container restart | Health, session, wallet, DNA, collectible placement, pending snapshot, request replay and confirmed commit checked |
| `npm run package:windows` | ZIP packaging passed on Linux; native Windows execution remains a CI/device result |
| `npm audit --omit=dev` | 0 vulnerabilities reported at validation time |
| `git diff --check` | Passed |

## Tested behavior

- Exact existing seven-tier probability array and shared price table; 42 unique definitions with two designs per category/tier.
- x1/x10/x100 collectible draws; balance deduction; insufficient funds; category/count validation; ownership and independent inventories.
- Real 50,000-row item inventory and 50,000-fish collection on PostgreSQL, including page 1,042, counts, empty filtering, bounded state responses and 50,000-to-5,000-ticket recycling without a parameter-limit failure.
- Fish storage retains paid progression; final upgrade stops at 50,000; capacity failures preserve money/tickets.
- Recycling 8/19/25/109 selections, separate tiers, complete groups, leftovers and immutable server selection. Locked, limited and breeding fish are protected. Placed/equipped/locked collectibles are excluded.
- All-category recycling rolls back earlier categories if a later category's snapshot changed; incorrect snapshot identities refuse.
- All three new ticket categories open in bulk at the ticket rarity or higher. Fish tickets preserve existing historical limited-fish rules. Stack quantities, locks, partial opening/deletion and food protection are covered.
- Real API duplicate requests and concurrent draws retain one charge/reward per request; inventory routes reject unauthenticated clients.
- Actual backend subprocess shutdown/restart retains normalized fish, money, sessions, placement, ticket quantities and a pending snapshot; commit/replay remain safe afterward.
- Existing migrations repeat concurrently, old SQLite import preserves state and new normalized tables, cross-process auction/economy transactions and connection recovery remain covered.
- Browser draws use real API accounts. Mouse drag, rotation/resize controls, background preview/equip, fish equipment and refresh work with a single aquarium canvas. Bulk selection shows exact counts, destructive preview confirms, new pages translate in all five languages and fit 390-pixel layouts. Existing suites also cover 768/1440 layouts, audio, reduced motion, fullscreen, offline/reconnect and maintenance.
- 533 keys in each dictionary with matching interpolation and AST checks for new JSX labels/attributes. Fish names, IDs and DNA are not translated.

Screenshots were visually inspected: [equipped aquarium](expansion/aquarium.png), [mobile inventory](expansion/mobile.png). Existing aquarium screenshots were restored.

## Fixes discovered during validation

Regression checks caught an ambiguous old Aquarium/Parent selector after adding new controls, a stale sold-fish choice in the market picker, a test fixture omitting migration files, and a restart assertion that omitted the newly added item spend. A fast native-fullscreen exit under load also exposed queued event ordering; the controller now records successful entry from its Promise as well as fullscreenchange, with a unit regression. These were corrected and relevant suites repeated. The smoke account name was shortened to satisfy the existing username length rule.

## Limits

No real Neon/transaction-pooler or Render spin-down test is claimed. Local PostgreSQL fixtures use isolated random schemas, including repeat migration/import/process restart tests. Cleanup removes only those test schemas/containers.

Chromium/Linux was tested, including simulated desktop/tablet/mobile viewport dimensions; physical iOS/Android/Safari/Edge, long-session battery/FPS profiling and professional translation review remain unverified. Procedural artwork has no external assets. Pagination and render budgets were verified by code/functional tests, not a claim of fixed FPS on every device.

Remote GitHub Actions results must be checked on the PR; local passing tests are not remote CI certification. The feature adds no hosting variables and was not merged or deployed. Existing admin tooling was tested only against synthetic fixtures; no real TaYuak balance was modified.

## Changed files

- Backend: new `collectibles.js`, `fish-store.js`, `fish-bulk.js`, `fish-tickets.js`, `stacks.js`, `bulk-recycling.js`; integrated `game.js`, `server.js`, `db.js`, `sqlite.js`.
- Schema/shared rules: new `database/migrations/002_collectibles.sql`, `003_fish_inventory.sql`, `shared/collectibles.js`; existing fish probability/rules file unchanged.
- Frontend: new `Expansion.jsx`, `FishInventory.jsx`, `FishPicker.jsx`, `StackInventory.jsx`, `RecyclingAll.jsx`, `collectible-art.js`; integrated existing main/stage/renderer/styles and dictionaries.
- Import/tests: `scripts/import-sqlite.js`, `scripts/test-postgres.js`, new `tests/collectibles.test.js`, `fish-expansion.test.js`, `tests/pages/expansion.spec.js`; migration/import/restart, launcher, localization and legacy browser fixtures adjusted.
- Documentation: README, feature/validation reports and two new screenshots. No secret, actual connection string, player database or uploaded asset is committed.
