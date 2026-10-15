# PostgreSQL migration validation

Validated locally on 16 October 2026 (Asia/Bangkok). This report covers an isolated test database, not Neon or any production player database.

## Results actually observed

Environment: Node 24.19.0, PostgreSQL 17.11 in a disposable Docker container, Chromium 154 on Linux.

| Check                                        | Actual result                                                                                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`, install `pg`, lockfile             | Passed; original dependencies retained                                                                                                                                                                           |
| `TEST_DATABASE_URL=… npm test`               | **37 passed, 0 failed, 0 skipped**                                                                                                                                                                               |
| `npm test` without PostgreSQL URL            | **29 passed, 0 failed, 8 PostgreSQL integrations explicitly skipped**                                                                                                                                            |
| `TEST_DATABASE_URL=… npm run test:postgres`  | **33 passed, 0 failed, 0 skipped**                                                                                                                                                                               |
| `npm run build`                              | Passed                                                                                                                                                                                                           |
| `npm run test:e2e`                           | **3 passed**: full keeper journey, trading/bids, maintenance; includes offline rendering and reconnect                                                                                                           |
| `npm run test:pages` with local SQLite       | Passed the original subpath/cross-origin/offline journey before adding the new retry regression case                                                                                                             |
| `TEST_DATABASE_URL=… npm run test:pages`     | **2 passed** against actual PostgreSQL: cross-origin session without cookies, subpath/reload/offline/resync; committed action with simulated 503 acknowledgement loss reuses the same key without charging twice |
| Production Dockerfile build                  | Passed, non-root runtime                                                                                                                                                                                         |
| Final image smoke / actual container restart | Passed health, HTML, registration, authoritative gacha, session/wallet/fish/DNA persistence                                                                                                                      |
| Render-style `PORT=3377`                     | Passed; HTTP health on supplied port; Docker health command reads PORT                                                                                                                                           |
| Docker PostgreSQL TLS                        | **TLSv1.3** observed via `pg_stat_ssl`; trusted test certificate with hostname verification; removing test CA rejected certificate with `DEPTH_ZERO_SELF_SIGNED_CERT`                                            |
| `npm audit --omit=dev`                       | **0 reported vulnerabilities** at validation time                                                                                                                                                                |
| `git diff --check`                           | Passed                                                                                                                                                                                                           |

The Docker application mounted only a read-only test CA certificate, **no player-data disk**. PostgreSQL lived in a separate local test container. The CA/key were generated under the workspace scratch directory and are not committed. Local database trust authentication is limited to the disposable test environment; it is not a production setting.

## Database and safety cases

- Repeated/concurrent migrations; a newly opened pool reloads existing data.
- Existing game tests run against both adapters, including 1,000-fish gacha, breeding/DNA/lineage, storage, items, rewards, maintenance and tax rules.
- Concurrent purchases through independent pools allow exactly one sale; wallets and permanent deliveries agree.
- Competing bids preserve escrow/refunds; concurrent settlement happens once. Injecting failure after transfers rolls all participant state back.
- Two independent HTTP app instances share one durable idempotency table. Simultaneous case-insensitive registration creates only one account; concurrent recovery consumes the old code only once and revokes the old session.
- An actual child backend process is stopped/restarted multiple times: session, request key, fish IDs, wallet and maintenance flag survive.
- Actual PostgreSQL connection termination is followed by a new pool connection; committed data remains and subsequent purchases work.
- Health returns 503 on an injected database failure, then returns 200 after the injection is removed.
- SQLite import preserves every legacy table, listing order, audit sequence, sessions, request keys and maintenance state. Re-import into a populated target refuses to run. A case-collision import fails mid-operation and leaves destination users empty and source unchanged.
- Render refuses missing DATABASE_URL, insecure cookie configuration and malformed public origins. TLS configuration always verifies certificates for remote database hosts.

## Files changed

- Database: `backend/db.js`, new `backend/sqlite.js`, `backend/migrate.js`, new `database/migrations/001_initial.sql`, `database/README.md`.
- Game/API: `backend/game.js`, `backend/server.js`; asynchronous database calls and complete transactions retain original rules. Lineage writes are batched to reduce remote round trips.
- Frontend: `frontend/src/main.jsx` preserves the pending key and enters connection recovery for 5xx responses.
- Hosting/security: `Dockerfile`, `Dockerfile.offline`, `render.yaml`, `.env.example`, `.gitignore`, `.dockerignore`, `package.json`, `package-lock.json`.
- Operator/testing scripts: new `scripts/import-sqlite.js`, new `scripts/test-postgres.js`, `scripts/maintenance.js`, `scripts/backup.js`, `scripts/package-windows.js`, `scripts/pages-test-server.js`, `scripts/verify-backend.js`.
- CI: `.github/workflows/ci.yml` runs a PostgreSQL service and Pages browser tests; `.github/workflows/pages.yml` requires actual remote PostgreSQL readiness/CORS plus local backend tests before publication.
- Tests: `tests/api.test.js`, `tests/backup.test.js`, `tests/browser/game.spec.js`, `tests/cors.test.js`, `tests/game.test.js`, `tests/inventory.test.js`, `tests/pages/pages.spec.js`, `tests/persistence.test.js`, new `tests/helpers/database.js`, new `tests/postgres.test.js`.
- Documentation: `README.md`, `DEPLOYMENT.md`, `GAME_RULES.md`, `docs/ARCHITECTURE.md`, `docs/ONLINE_SETUP.md`, new `docs/NEON_RENDER.md`, this report.

Generated browser screenshots were restored to their original repository versions. No actual player database, credential, TLS key, or connection string was added.

## Not tested or performed

- **No real Neon DATABASE_URL was available.** Neon TLS, PgBouncer/session behavior, quotas and actual Neon suspend/resume remain unverified. The code uses transaction-scoped locks, parameterized unnamed queries and SET LOCAL settings suitable for a transaction pooler, but this is not a Neon integration result.
- No Render service was provisioned/deployed; actual Render free-tier cold start/spin down, routing and managed TLS remain untested. Docker and local process restart are the evidence for persistence.
- No live SQLite player data was imported or edited. Import tests used synthetic fixtures only.
- No GitHub Pages production deploy, production database restore, offsite backup restore drill, Windows native execution in this Linux session, Safari/mobile-device run, large-scale load test or external penetration test was performed.
- GitHub Actions workflow configuration is prepared; remote run results must be checked on the PR. A local test result is not a claim that remote CI passed.

Production provisioning/import/cutover/deployment and PR merge remain owner-controlled actions. Use [NEON_RENDER.md](NEON_RENDER.md) for all Render environment variables and safe deployment/import steps.
