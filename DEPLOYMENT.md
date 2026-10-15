# Deployment and operations

No public deployment is provisioned and no public URL is claimed. All tested URLs in logs are internal validation only. The owner must provide/authorize a target hosting account or server before an external deployment can be completed; do not invent a URL, purchase hosting, or publish credentials.

## One machine / private play

Run `scripts/start-game.sh` (Mac/Linux) or `scripts/start-game.bat` (Windows; prepared but not tested here). Node 24 LTS required. These run lockfile installation, migration, production build and server start. Open port 3000 on that same machine in the browser. Local HTTP sets COOKIE_SECURE=false. Data survives restart in `data/aquarium.sqlite` plus WAL files. Keep the server window open. Stop with Ctrl+C.

## Docker Compose

`docker compose up --build -d` builds and starts one game instance with a named durable volume. `docker compose logs -f` shows startup output; `docker compose stop` stops without deleting data. Never use `down -v` unless deliberately destroying the aquarium database. No external DB needed.

Default Compose settings are for HTTP on the same computer. For a public domain put a TLS reverse proxy in front, set `COOKIE_SECURE=true` and `PUBLIC_ORIGIN=https://your-actual-domain` (no trailing slash), and allow only the proxy to reach the game port. Public production requires HTTPS for secure cookies and service-worker offline behavior. PUBLIC_ORIGIN is checked for browser mutation requests, including reverse-proxy deployments. Serve app and API under the same origin. No permissive CORS required. Do not set COOKIE_SECURE=false on a public HTTP server.

Build: `npm ci && npm run db:migrate && npm run build`. Run: `NODE_ENV=production node backend/server.js`. Mount durable writable data directory, configure DB_PATH and PORT if needed. Health: `GET /api/health` returns `status:ok,database:ready`; readiness beyond health must include registration/login/game requests, not just port availability. Backend opens on 0.0.0.0. The Docker runtime uses non-root node user.

Node production build includes no remote asset services. No email key, cloud DB credential or GitHub token is needed to run this app. For externally accessible deployment, choose a host with **durable disk**; ephemeral/serverless filesystem hosting loses SQLite state. One app process is the supported deployment model.

## Maintenance

Set DB_PATH identically to the server, then run:

```sh
node scripts/maintenance.js on
node scripts/maintenance.js off
```

In Compose: `docker compose exec game node scripts/maintenance.js on` (or off). Maintenance blocks state-changing gameplay, pauses online time and extends auctions on resume. Do not toggle while DB backups are running. There is no internet-exposed admin endpoint or default admin password.

## Backups

Safest manual method: stop the game, copy the **entire data directory** to a protected durable backup, restart. In Docker, stop the service and back up the named volume through your platform's volume backup facility. Never copy only the main sqlite file while WAL writes are active. For a live backup use SQLite's online backup facility through an administrator-approved tool; backup/restore is not automated here. Validate a restored copy using `PRAGMA integrity_check` before replacing production. Backups contain sensitive account/session data; restrict access.

## Pre-public-launch work

- Hosting account/domain/TLS and durable volume authorization; actual external deployment and HTTPS validation remain undone.
- Automated backups/restore drills, monitoring, abuse controls, signup verification and load testing are not supplied as a managed service.
- SQLite single-instance architecture is tested; horizontal replication, PostgreSQL, multi-region operation and large-scale economy abuse resistance are not claimed.
- PWA shell works in Chromium on localhost/HTTPS; App Store packaging, Safari device tests and cross-device install behavior remain unverified.
- Windows launcher is provided; it has not been exercised on a Windows runner.
- Inventory includes unique recycling tickets and food stacks capped at 999, covered by transaction tests.

## Restricted cloud build networks

The cloud host can install packages while Docker build stages may not inherit its egress route. `Dockerfile.offline` builds the same application using a named context containing npm's content-addressed cache. It still executes `npm ci --offline` and verifies `package-lock.json` integrity; no TLS or checksum checks are disabled. Prepare the cache with a normal verified installation, then build:

```sh
npm ci --cache /workspace/.npm-cache
DOCKER_CONFIG=/workspace/.docker docker build --build-context npm-cache=/workspace/.npm-cache/_cacache -f Dockerfile.offline -t dream-aquarium:local .
```

`DOCKER_CONFIG` redirects Docker's writable client metadata in this cloud only. On an ordinary computer, `scripts/build-container-offline.sh` prepares its own cache and builds. `Dockerfile` is the normal network-enabled variant; it optionally accepts a BuildKit secret named `extra_ca` containing an existing trusted CA certificate, if the organization's proxy requires one. Do not disable TLS verification or embed proxy credentials in image layers.

The validation container uses COOKIE_SECURE=false for local HTTP smoke checks. `scripts/container-smoke.js` registers an isolated synthetic account and checks real game mutations; never run it against a live public player database without intending to create that test account.
