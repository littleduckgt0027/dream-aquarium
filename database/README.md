# Database

Executable migration source: backend/db.js. `npm run db:migrate` applies `CREATE TABLE IF NOT EXISTS` migration v1 and PRAGMA user_version=1. WAL + foreign keys + busy timeout. Future incompatible migrations must explicitly upgrade versioned data rather than silently replacing state. Never run tests against a player's DB.

Tables: users (hashed credentials, serialized authoritative player state), sessions (hashed cookie tokens + expiry), listings (fish escrow, currency bid escrow, lifecycle), requests (user-scoped idempotency), audit (server gameplay actions), lineage (permanent DNA/ancestry archive), meta (persistent maintenance start timestamp).

Only the server writes balances/ownership. `BEGIN IMMEDIATE` encloses economy and cross-user mutations. JSON player documents simplify the initial local deployment, but limit horizontal scale and incremental state fetch. Do not share this SQLite database across independently replicated writers or network filesystems. PostgreSQL migration and normalized high-volume tables are future scaling work, not claimed as delivered here.
