# Online release runbook — no fabricated deployment

Verified existing repository identity: https://github.com/littleduckgt0027/dream-aquarium (native Git read works). Target Pages URL, **not yet verified as deployed**: `https://littleduckgt0027.github.io/dream-aquarium/`. No backend URL has been provisioned. Do not set a placeholder API URL or publish a static-only game that pretends to save player data.

## Required hosting

Backend uses Node 24 + durable SQLite WAL on a single server. GitHub Pages cannot run this backend or database. Choose an already-authorized always-on server with persistent disk, or authorize a suitable hosted service. No hosting account/credential is available in this session. Render's free web service has ephemeral storage and is unsuitable for this database; it must not be presented as a free durable game host. `render.yaml` is a **prepared paid Starter/disk option only**, never automatically provisioned and requiring the owner's cost approval. An existing VPS with Docker/durable disk avoids subscribing to a new provider. No provider has been purchased or provisioned here.

## Backend settings

Deploy existing Dockerfile and mount durable `/app/data`, DB_PATH=/app/data/aquarium.sqlite, NODE_ENV=production, COOKIE_SECURE=true, PUBLIC_ORIGIN set to the actual HTTPS backend origin. Set FRONTEND_ORIGIN=`https://littleduckgt0027.github.io` (origin only, no project path). Set TRUST_PROXY_HOPS only to the verified proxy count (Render template assumes one). Avoid additional replicas; preserve database and WAL across updates/restarts.

CORS permits only same-origin or the one explicit FRONTEND_ORIGIN. Preflight allows Content-Type, Authorization and Idempotency-Key. No wildcard or credentialed CORS. Local same-origin gameplay retains HttpOnly SameSite cookies. The separate Pages frontend uses a short-lived-in-browser-tab bearer credential returned **only** to the configured remote origin; it is kept in sessionStorage, not localStorage or build output. Server stores only token hashes with 30-day expiry; logout/recovery revoke sessions. This avoids browsers' third-party-cookie restrictions. It trades HttpOnly isolation for tab-scoped JS access on the split-origin frontend; maintain XSS protections, avoid third-party scripts, never log/session-export bearer values. Closing the tab requires re-login online; visual offline cache does not grant ownership.

## GitHub settings

1. With repository admin access, select Settings → Pages → Source: GitHub Actions.
2. After backend HTTPS health is verified, set repository Actions variable **PRODUCTION_API_URL** to its exact HTTPS origin (no path/query/credentials). This is public config, not a secret.
3. Push to main or run `Deploy GitHub Pages frontend`. Workflow refuses to publish if no actual healthy database-backed API is configured. It builds VITE_BASE=/dream-aquarium/ and VITE_API_URL from that variable, tests game, uploads Pages artifact and deploys using OIDC. Repository permissions: contents read, pages write, id-token write.
4. Inspect successful CI on Ubuntu and Windows. CI Windows runs fresh-folder launcher integration tests and builds a downloadable Windows artifact; a configured workflow is not itself evidence that Windows passed.
5. Verify the actual public Pages HTTPS URL on desktop/tablet/mobile, assets and console, registration/login/reload/gacha, two-account market and delivery, offline/auto-reconnect, and backend restart persistence. Local split-origin tests do not establish public deployment success.

## Current access blocker

`gh api repos/littleduckgt0027/dream-aquarium`, `/user`, and `/pages` returned **Forbidden** in this cloud. Git access is separately functional. A GH_TOKEN variable exists; its value was not displayed or copied. No replacement token has been requested because this first needs API egress/access diagnosis. A cloud configuration draft adds `api.github.com` and `littleduckgt0027.github.io` without changing selected package-manager presets. The owner can Review/Save the environment changes and Publish to retain them; saving a draft alone does not apply or prove runtime access. After settings are applied, retry these read-only API operations before assuming credentials/scopes are missing. Enabling Pages, setting variables, obtaining workflow outcomes and testing the public URL remain blocked/unverified until access and hosting are available.

## Backup and recovery

`node scripts/backup.js backup data/backups/NEW-NAME.sqlite` uses SQLite's online backup API (safe with active WAL), verifies integrity and refuses to overwrite existing files. Copy backups to a separate protected durable destination; an in-volume backup alone is not disaster recovery. No managed/offsite backup service is claimed.

`node scripts/backup.js restore data/backups/NAME.sqlite data/restored.sqlite` restores to a **new** path and verifies integrity. Stop the service before deliberately changing DB_PATH to that restored file. This command never overwrites a live database. Test restores on isolated copies before production use. Backups contain account hashes and sensitive session/state data; do not commit or distribute them.
