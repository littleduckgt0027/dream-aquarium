# Dream Aquarium — persistent development checkpoint

Updated 2026-10-15 (Asia/Bangkok). Source requirement: `docs/MASTER_PROMPT.md`.

## Current phase
Phases 1–10 implemented as a playable single-server release. Functional game is built and locally validated; public hosting and production operations remain outstanding. Do not describe it as a deployed public service or proven at large scale.

## Completed systems
- React responsive frontend; actual Canvas aquarium with original procedural fish, swaying plants, rocks, bubbles, layered lighting, eased turning, DNA-dependent shape/fin/tail/pattern/eye/color and growth scaling.
- Node 24 Express server, SQLite WAL, repeatable migration, durable state, same-origin API, scrypt accounts, HttpOnly/SameSite cookie sessions, rotated one-time recovery codes and session revocation.
- Seven rarities and full unique DNA, server-authoritative age/growth, tank and storage, sorting/search/filtering, local collection pagination, upgrades, confirmed release, persistent ancestor archive and lineage inspection.
- Timed breeding, genetic inheritance, recombination, mutation, fertility-dependent 1–2 offspring, generation counter, parent locks, single claim.
- Pearl wallet and transaction history, 1/10/100/1000 gacha/discounts/probability disclosure/no pity, same-tier recycling, non-tradable conditional-rarity tickets, separate confirmed Limited probability table.
- Inventory food with <=999 per stack and atomic consumption; feeding boosts growth without changing true birth date or DNA. Unique tickets and Limited fish remain separate records.
- Real two-player fixed listings/auctions, 6/12/24/48h, buyout, bid/own-bid escrow, outbid refunds, 10% completed sale tax, item escrow, cancellation, permanent delivery inbox, slot expansion to 100 at exactly 796,000 Pearl, sale history, server market pagination/search/filter/sort.
- Visible-tab server online-time heartbeat, no offline/maintenance income, Bangkok month reset, lifetime 3-hour Pearl steps, 24/48/100/240h Limited milestones, selection-required Sunrise/Moonlight variants, collection journal and historical All-Month Pool with uniform eligible month selection.
- Permanent separate Reward/Delivery inboxes, duplicate prevention, Claim All skips mandatory selections, no inventory overflow loss.
- Production offline service worker/app shell, cached aquarium animation, write lock, automatic/manual reconnect and authoritative resync.
- Operator-only maintenance CLI, transactions blocked, online intervals reset, already-ended auction settlement before pause, remaining auctions extended on resume, frozen maintenance countdown UI.
- Security input/ownership checks, cryptographic RNG, transaction serialization, request idempotency, audit log, rate limits, secure cookies when deployed with HTTPS.
- Production build, Node launch scripts (Linux/Mac + prepared Windows launcher), cross-platform npm start, Docker non-root image, durable data volume, health and smoke scripts, documented deployment/backups and rules.

## Verified results
- `npm test`: **22 passed, 0 failed, 0 skipped**, covering genetics, growth, 1000-roll gacha, breeding, ownership, recycling, transaction rollback, balances, tax, auction refunds/settlement/own escrow, concurrent HTTP buyers, idempotency, authentication/recovery/logout/CSRF, calendar/rewards, maintenance, inventory and database restart integrity.
- Full `npm run test:e2e`: **3 passed**, actual Chromium, real 2-minute breeding wait/offspring claim, fish moves, gacha, food, navigation, 390px mobile overflow assertion, offline page reload/reconnect; two independent accounts trade/bid/buyout/claim; operator maintenance view/lock/unlock.
- Following final auction/startup adjustments, the affected two-player and maintenance browser tests were rerun separately and passed. Unit tests rerun as well.
- `npm run build`: production assets built successfully. Production JS ~264 KB / ~82 KB gzip; CSS ~18 KB / ~4.8 KB gzip.
- `npm audit --omit=dev`: 0 reported vulnerabilities at check time (not a blanket security guarantee).
- Frozen dependency reinstall + repeat migration + build executed using the exact saved cloud install steps.
- Docker image built with `Dockerfile.offline`, lockfile integrity-checked npm cache. Normal container-network installation stalls in this cloud egress configuration; offline cache is the verified alternative. TLS and checksums were not bypassed.
- Container started as non-root after fixing source-file ownership, passed actual HTTP health/HTML/register/state/gacha checks, then container restart retained session, wallet, all fish and DNA. The application healthcheck reported healthy.
- Production Node server started on port 3000 in the current cloud instance; internal health request returned database ready. This is not a public game URL. Processes may stop when the session/snapshot changes.
- Actual desktop/mobile screenshots: `docs/aquarium-desktop.png`, `docs/aquarium-mobile.png`.

## Fixed during validation
- Starter fish age originally too young for slower-growth DNA; starter fish now all mature.
- Existing bid escrow can now fund own buyout and incremental self-raise, without needing an extra full wallet balance.
- Auctions that ended before maintenance settle before countdown pause; maintenance display freezes.
- Docker source files with restrictive host permissions now have node ownership in the runtime image.
- Browser test reload navigation/implicit select-label matching corrected; missing selector waits bounded to 10 seconds.
- Production npm start no longer relies on POSIX-only environment assignment, so the provided Windows launcher can invoke it (Windows itself not tested).

## Reusable cloud configuration
Saved and confirmed draft `install_script` and `start_skill`: dependency install, migration, build; existing checkout/no worktrees, start process, internal readiness checks and test instructions. No network rules, secret bindings or repository membership were replaced. Draft requires user Review/Save and Publish in Environment settings; this is distinct from public game deployment. No publication has been claimed.

## Remaining work and known limitations
- No public hosting account/domain provisioned, no HTTPS endpoint, no public deployment URL. A hosting target/account authorization is needed before deploying externally. Do not buy services or invent links.
- SQLite replaces recommended PostgreSQL intentionally. Supported runtime: one app instance + durable disk. Shared/network filesystems, multi-node scaling and PostgreSQL migration are future work.
- Signup bot/account farming protection, email verification, managed monitoring/backups, restore drills, and production load testing remain launch work. Functional tests do not establish abuse-proof public economy behavior.
- Online time deliberately counts observed intervals <=45s. A 10-minute reconnection grace preserves state but does not credit unobserved offline time. See GAME_RULES.md. Long milestones/auction deadlines use controlled server timestamps in unit tests; no claim of 240h/48h real-time testing.
- No known failing required functional check at checkpoint. Windows launcher, Safari/iOS devices, cross-browser PWA installation and public TLS deployment remain unverified.
- User-facing game UI is English; Thai instructions are in README. Localization can be added later without changing confirmed rules.
- Per-user state/ledger/inbox JSON is durable but not yet optimized for huge lifetime histories. Avoid claiming unbounded-scale performance.
- Local development milestone is saved in Git; no GitHub push or public release is claimed.

## Resume instructions
Read this file and docs/MASTER_PROMPT.md; use existing /workspace/dream-aquarium checkout. Do not replace or discard working systems. Preserve data/ and user modifications. `npm ci --cache /workspace/.npm-cache && npm run db:migrate && npm run build`; start with `COOKIE_SECURE=false npm start` for cloud internal HTTP only. Public service must use HTTPS/COOKIE_SECURE=true/PUBLIC_ORIGIN. Run `npm test` and relevant browser tests after changes. Full browser suite intentionally waits 2 minutes. Test DB /tmp/dream-e2e.sqlite is separate from player data. See DEPLOYMENT.md for verified offline Docker build and operator commands.

## Repair release checkpoint — Windows launcher and Pages (2026-10-15)

Latest task: docs/REPAIR_REQUEST.md. See docs/REPAIR_AUDIT.md and docs/ONLINE_SETUP.md; these supersede earlier limitations about absent launcher orchestration, split-origin API and missing backup tooling.

Implemented root START-GAME.bat/STOP-GAME.bat and portable launcher with Node validation, frozen install/build reuse, owned instance/PID matching, startup lock, default browser, readiness, log and safe stop. Broken/mismatched output assets trigger a fresh build. SQLite online backup and non-overwriting restore verified. Pages subpath, relative manifest/icon and scoped SW work; remote API uses exact CORS origin and tab-scoped bearer sessions, preserving HttpOnly cookies for local play. No game economy rules changed. Added Ubuntu/Windows CI, guarded main-branch Pages workflow, Windows ZIP builder, durable hosting blueprint (paid Render option NOT provisioned).

Verification: 26 unit/API/database/security/launcher cases passed; 3 full Chromium game journeys passed; 1 additional Pages/static-frontend + separate-origin backend browser test passed (cookie-free login/reload/gacha/mobile-tablet/offline/reconnect). Fresh-folder launcher tests verify install/build/duplicate PID protection/stop/restart/session+wallet+DNA persistence and foreign-port protection. ZIP extraction and actual engine startup from a new path with spaces passed on Linux. Windows .bat/default-browser operation and GitHub Windows CI results remain NOT VERIFIED. Production dependency audit: zero known reported vulnerabilities.

Git read and dry-run write to existing repository succeeded. Actual push outcome is recorded in docs/RELEASE_STATUS.md after execution. No force pushes. GitHub API calls currently Forbidden; existing GH_TOKEN presence was checked without exposing value. Saved additive API/Pages domain draft (api.github.com, littleduckgt0027.github.io) preserving presets; owner must Review/Save and Publish relevant environment settings before API egress can be re-tested. Draft save does not establish live access. No extra secret binding requested pending access diagnosis.

External blockers: no authorized always-on backend host or public HTTPS API; GitHub API/settings/workflow-result access unverified/blocked; PRODUCTION_API_URL unset. Pages workflow deliberately fails its prerequisite instead of publishing a broken static-only game. No public game URL claimed. Render free ephemeral disk is unsuitable and paid starter template is not authorization to incur costs. Use an existing durable-disk server or obtain explicit hosting authorization.

Resume: preserve all prior game code/data. Verify GitHub remote push result and retry API after a real settings/access change; configure actual durable backend and FRONTEND_ORIGIN, then PRODUCTION_API_URL and Pages Actions source; verify remote Windows CI and public HTTPS gameplay before calling DEPLOYED. Windows package output artifacts/dream-aquarium-windows.zip is ignored by Git and rebuilt via npm run package:windows. Cross-platform e2e runner now uses scripts/e2e-server.js; npm run test:pages tests split-origin deployment locally. No token/secret/database belongs in the ZIP or Git.

Actual remote outcome: game + repair commit 2715226 successfully pushed main and verified through git ls-remote. GitHub Actions web request returned 404 (not a CI result); API still requires access diagnosis. Detailed truthful COMPLETED/TESTED/DEPLOYED/BLOCKED/NOT VERIFIED statuses are in docs/RELEASE_STATUS.md. No public service claimed. Final package is distributed as dream-aquarium-windows.zip.
