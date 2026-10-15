# Multilingual UI, audio and admin CLI: validation

Validated on 16 October 2026 (Asia/Bangkok), using Node 24.19.0, Chromium 154 on Linux and a disposable local PostgreSQL 17.11 instance. No production database was connected, no real TaYuak account was modified, and nothing was deployed.

## Actual results

| Command/check                               | Result                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL=… npm test`              | **52 passed**, 0 failures, 0 skips                                                                                                                                                      |
| `npm test` without test PostgreSQL          | **43 passed**, 0 failures, **9 explicit skips** (8 existing PostgreSQL-only cases + the actual admin subprocess integration)                                                            |
| `TEST_DATABASE_URL=… npm run test:postgres` | **41 passed**, 0 failures/skips, including the admin cases                                                                                                                              |
| `npm run build`                             | Passed; frontend JS approximately **429 kB raw / 129 kB gzip**, includes all five dictionaries and synthesis; no audio downloads                                                        |
| `npm run test:e2e`                          | **3 passed**: existing full journey/breeding/offline, multi-account trade/auction, maintenance                                                                                          |
| `TEST_DATABASE_URL=… npm run test:pages`    | **5 passed**: five-language navigation/responsiveness; real AudioContext preferences/offline; keyboard/fallback; original Pages journey; committed-response-loss idempotency regression |
| Docker production image build               | Passed with normal Dockerfile and verified build CA trust                                                                                                                               |
| Docker smoke and actual container restart   | Passed health/HTML/registration/gacha and persistence of session, wallet, fish and DNA; admin CLI present in runtime image                                                              |
| Windows ZIP packaging on Linux              | Passed; native Windows execution remains a separate CI/device result                                                                                                                    |
| `npm audit --omit=dev`                      | **0 reported vulnerabilities** at validation time                                                                                                                                       |
| `git diff --check`                          | Passed                                                                                                                                                                                  |

The first Docker smoke attempt raced initial startup; after the backend reported readiness, the smoke and actual restart both passed. This was a local test startup timing issue, not a claim about Render cold starts.

## Coverage

**Localization:** 398 matching keys in each of five dictionaries; interpolation tokens and plural forms; missing-key detection; default Thai; Intl number/date formatting; localized historical errors/reasons; AST check against hardcoded visible JSX/attributes (excluding the product brand). Browser checks traverse all 12 pages in each language, preserve usernames and search state, reload persisted preferences and check 1440/768/390-pixel layouts. Menu bounds are checked, including the corrected mobile dropdown alignment. Long desktop navigation labels remain reachable by scrolling.

**Audio:** no AudioContext before enabling; opening the panel does not start audio; actual browser context runs after the enable gesture. Master/music/ambient/effects controls, toggles, mute/unmute, saved preferences, refresh without autoplay, offline enable and reconnect preserve a single context. A dispatched visibility event with a hidden-document fixture verifies actual context suspension/resumption. Unit fakes check source/timer cleanup, preference validation and unavailable API/storage handling. There are no external samples or recordings; [provenance and architecture](LANGUAGES_AUDIO_ADMIN.md#original-audio-and-provenance) document the original synthesis.

**Admin:** exact case-sensitive target; other accounts unchanged; missing account refuses; explicit confirmation; dry-run with no account writes; total balance set rather than added; retries do not re-grant even after spending; simultaneous retries; rollback of wallet/ledger/operation on injected audit failure; existing inventory/fish/reward/ledger/audit history retained. Tests use the actual CLI subprocess for dry-run, confirmed execution and retry against an isolated PostgreSQL schema. An ordinary authenticated client receives 404 at the nonexistent admin route and 400 when attempting an admin action through normal gameplay. Default starting Pearl stays 3,000.

**Existing behavior:** PostgreSQL migrations, persistence, recovery, idempotency, concurrency, auctions/escrow/refunds, breeding, inventory, offline view and maintenance remain covered by existing suites. The English journeys now explicitly select English, including independently created buyer/seller contexts, so a Thai default does not invalidate their assumptions. Game and Pages test artifacts use separate output folders.

## Visual verification

Screenshots were visually inspected for Thai glyphs, preserved ocean styling, readable controls and mobile menu alignment:

- [Thai aquarium desktop](features/thai-desktop.png)
- [Thai mobile language menu](features/thai-mobile.png)
- [Sound controls](features/sound-controls.png)

They use synthetic test accounts with default balance, not the real TaYuak account. Existing `docs/aquarium-*.png` files were restored rather than replaced.

## Remaining limits

- No real Neon connection string was available. Neon/transaction-pooler behavior and production admin execution are **not** claimed tested. PostgreSQL tests use temporary schemas on local PostgreSQL; they clean up only their own schemas.
- No Render/GitHub Pages production deploy or actual Render spin-down validation was performed.
- Chromium was tested; physical Chrome/Edge/Safari/iOS/Android devices, OS font availability, audio output hardware, long-session CPU/power behavior, human listening quality and professional translation review remain unverified. Standard Web Audio and the prefixed Safari fallback are implemented, not a Safari certification.
- Remote GitHub Actions results must be read on the PR; local success does not imply remote CI success.
- TaYuak's actual current balance/existence is unknown because no production connection was used. Follow the separate approval, dry-run and confirmation sequence in [LANGUAGES_AUDIO_ADMIN.md](LANGUAGES_AUDIO_ADMIN.md#tayuak-separately-approved-operator-execution-only).

## Modified files

- UI: `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/Aquarium.jsx`, `frontend/src/style.css`.
- New runtime modules: `frontend/src/GlobalControls.jsx`, `frontend/src/audio.js`, `frontend/src/i18n/index.js`, `frontend/src/i18n/catalog.js`.
- Admin: new `scripts/admin-set-balance.js`; `scripts/test-postgres.js` includes its tests.
- Tests: new `tests/admin-balance.test.js`, `tests/audio.test.js`, `tests/i18n.test.js`, `tests/pages/features.spec.js`; adjusted English fixtures in `tests/browser/game.spec.js` and `tests/pages/pages.spec.js`; separate artifacts/diagnostics in `playwright.config.js` and `playwright.pages.config.js`.
- Dependencies: `package.json` / `package-lock.json` add **development-only** `@babel/parser` for accurate JSX translation coverage checks; no new production package.
- Documentation: `README.md`, new `docs/LANGUAGES_AUDIO_ADMIN.md`, this report and the three new screenshots in `docs/features/`.

No database schema migration, default currency change, new public admin API, paid service or secret is introduced.
