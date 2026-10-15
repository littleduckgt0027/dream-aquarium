# Database

Online production uses Neon PostgreSQL through `DATABASE_URL`. Startup applies versioned transactional migrations in `migrations/`; schema creation never drops existing player tables. `schema_migrations` records applied versions. Do not edit an applied migration; add a new version and register it in `backend/db.js`.

All original entities are retained: player documents (fish/DNA/tank/wallet/inventory/breeding/rewards/deliveries/history), sessions, listings/escrow, request keys, lineage, audit and maintenance metadata. Money remains an integer; timestamps are BIGINT milliseconds. PostgreSQL query results reject integers outside JavaScript's safe range.

SQLite WAL remains supported for the local desktop launcher, explicit local DB_PATH and legacy backup/import. See [Neon/Render operations](../docs/NEON_RENDER.md) for non-destructive import, deployment, backups and test commands. No live credentials or player database belongs in Git.
