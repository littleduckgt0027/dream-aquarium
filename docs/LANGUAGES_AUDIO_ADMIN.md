# Five languages, aquarium sound and the TaYuak test balance

This feature extends the existing game on Neon PostgreSQL + Render Free + GitHub Pages and the local Windows launcher. No production deploy, database reset or real-account balance adjustment is performed by this change.

## Languages

The top bar has a globe selector on every screen, including login/loading. A fresh browser defaults to Thai (`th`); Simplified Chinese (`zh-CN`), Japanese (`ja`), Korean (`ko`) and English (`en`) are included. `dreamLanguage` in localStorage remembers the selection. The React external store rerenders translated text immediately without remounting the game or discarding an open screen, search query or authoritative player state. The document `lang` attribute updates, too.

`frontend/src/i18n/catalog.js` contains **398 keys per language**: structured `ui.*` keys and the plural-aware `counts.fish` key. `i18n/index.js` provides interpolation, Intl.PluralRules, localized numbers and dates/times (Asia/Bangkok). Unknown keys or missing interpolation parameters throw and tests enforce coverage. Add keys to all five dictionaries together; never put new visible English literals directly into JSX.

`sourceKeys` maps historical server/system messages to their translation key, so existing errors, delivery reasons and ledger entries can be displayed in the chosen language **without rewriting the database**. Known dynamic discovery/limited-month reasons are handled explicitly. Unknown failures show a localized generic message. Player names, fish names, usernames, IDs, DNA field identifiers/values, month identifiers and the Dream Aquarium brand are preserved. The existing backend has no language preference setting, so no database field or migration is added for this optional preference.

Fonts use local Thai/CJK/system fallbacks, without external font requests. Long navigation labels can scroll within the desktop sidebar. On mobile, the original horizontal navigation remains and both language/sound controls stay next to the balance/profile. Menus support Escape/outside-click, arrow keys, Home/End, native radio-menu semantics and focus return; sliders have explicit accessible labels.

## Original audio and provenance

**All music and sound are original programmatic synthesis in `frontend/src/audio.js`.** There are no downloaded recordings, commercial songs, samples, voice tracks or third-party audio assets. There is no additional audio download or external audio service.

- A slow 16-note ambient sequence uses soft sine fundamentals and gentle upper harmonics, smooth envelopes and overlapping tails. The note sequence repeats continuously without an abrupt file boundary.
- Filtered, smoothed noise provides underwater water movement; its loop endpoints are blended. Gentle bubbles use restrained rising sine tones.
- Distinct quiet tones cover hover/click, fish selection, breeding, discovery, reward collection, trading, other successful interactions and notifications. Effects only follow UI/authoritative server results; they cannot change game state.
- One shared AudioContext/mixer has master, music, ambient and effects buses, plus a dynamics compressor. The master gain is bounded, layers fade in/out, hover events are throttled and transient polyphony is bounded. Navigation never creates a second music instance.
- AudioContext is not constructed before the user explicitly presses **Enable sound**. Opening the panel, changing language or restoring preferences does not start playback. Refresh requires another enable gesture even if the previous session played audio.
- Visibility changes fade/suspend the context and stop the scheduling timer; returning resumes only a previously activated context with enabled nonzero layers. Unmount cleanup cancels timers, stops/disconnects sources and closes the context.
- `dreamAudio` stores master/music/ambient/effects levels, three on/off switches and mute state locally. Invalid values are bounded; unavailable APIs/storage failures degrade gracefully. Audio works without the network after the app shell is cached.

The implementation uses standard Web Audio with the legacy `webkitAudioContext` fallback. Chrome/Chromium has automated coverage. Edge, real Safari/iOS/Android devices, physical speakers/headphones, long listening sessions and subjective mastering have not been certified in this environment.

## TaYuak: separately approved operator execution only

**The real TaYuak account has NOT been changed.** The owner must approve the production execution separately. No public admin endpoint, frontend balance code, cheat code, automatic startup adjustment or increased starting grant exists.

The command is deliberately restricted to exact case-sensitive username `TaYuak` and exact target balance `1000000000`. It requires one matching account and never creates a missing account. Its dry-run reports the account identifier/current balance/target without modifying account data. Actual execution requires the explicit confirmation token.

After approval, use a trusted operator machine with Node 24 and the reviewed source/dependencies. Keep the real `DATABASE_URL` in a private environment/secret manager; do not paste it into this repository, GitHub Actions variables, screenshots or shell-history command lines. An option is a protected local `.env` file (already ignored by Git), used as follows:

```sh
# Install reviewed dependencies; these commands do not change production data.
npm ci

# Read-only account review; DATABASE_URL must be in the private environment.
node scripts/admin-set-balance.js --username TaYuak --balance 1000000000 --dry-run

# Alternative when using a protected local .env file:
node --env-file=.env scripts/admin-set-balance.js --username TaYuak --balance 1000000000 --dry-run
```

Review the **exact username and account ID** printed by dry-run. If no account matches, stop and investigate; do not create another account or change the command's targeting. For an unambiguous post-commit balance check, coordinate a brief pause in that test account's spending.

**Only after separate owner approval of this production mutation**, execute either the environment-based form or the `.env` equivalent:

```sh
node scripts/admin-set-balance.js --username TaYuak --balance 1000000000 --confirm TaYuak:1000000000
# Or:
node --env-file=.env scripts/admin-set-balance.js --username TaYuak --balance 1000000000 --confirm TaYuak:1000000000
```

The command sets the total to one billion; it does not add a billion. It first acquires the existing durable economy transaction lock, then locks the exact user row in PostgreSQL. It preserves all other player state, appends a ledger delta (`target - previous`), appends an `admin_set_balance` audit record and records a durable operation key in the existing `requests` table within the same transaction. Failures roll back all of those changes.

It reads the balance again after COMMIT and prints `verifiedBalance`. If gameplay immediately changed the balance before verification, the command reports that ambiguity and does not auto-reapply. The fixed one-time operation key is `admin-set-balance-TaYuak-1000000000-v1`: retries report `alreadyApplied: true` and the **current** verified balance, without another grant or resetting money already spent. Never delete that record merely to repeat a grant. A future distinct adjustment requires a new reviewed operation and separate approval.

The CLI refuses to run without DATABASE_URL and never falls back to a local SQLite file. It does not print database connection strings, passwords or driver error details. Unit tests use synthetic accounts and PostgreSQL integration uses an isolated randomly named test schema; none connect to the real TaYuak account.

## Deploy preparation

No additional Render environment variables, storage service, database migration or paid audio service is required for these features. Keep the existing [Neon/Render setup](NEON_RENDER.md): DATABASE_URL private in Render, secure production cookies, explicit Pages origin, and PRODUCTION_API_URL as a public GitHub Actions repository variable.

After owner approval, review/merge this PR. Rebuild/deploy Render's Docker service manually (auto-deploy remains disabled in the prepared blueprint); it includes the new CLI, whose balance adjustment still requires separate execution. For Pages, use the existing workflow with PRODUCTION_API_URL set. The workflow checks the real backend and runs tests before publishing. A main-branch push can trigger Pages deployment, so PR merge is also an owner-controlled publication step. Never put DATABASE_URL into frontend build variables.

The Windows launcher still uses local SQLite and bundles the new dictionaries/synthesizer in the normal Vite build. No external audio/font downloads are required. Language and audio preferences belong to the local browser, not to server-authoritative ownership or currency.

## Validation and visuals

See [FEATURE_VALIDATION.md](FEATURE_VALIDATION.md) for actual test results and limits. New screenshots use synthetic test accounts and are committed under `docs/features/`; existing aquarium screenshots are not replaced.
