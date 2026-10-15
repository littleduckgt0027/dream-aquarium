-- Player state retains the original complete game document: fish, tanks, wallet,
-- inventory, breeding, rewards, deliveries, collections, ledger and sales.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, recovery TEXT NOT NULL, state TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY, seller TEXT NOT NULL REFERENCES users(id), fish TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('fixed','auction')), price BIGINT NOT NULL CHECK(price > 0),
  buyout BIGINT, end_at BIGINT, bid BIGINT NOT NULL DEFAULT 0 CHECK(bid >= 0),
  bidder TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'open',
  rowid BIGSERIAL UNIQUE NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_settlement ON listings(end_at) WHERE status='open' AND type='auction';
CREATE INDEX IF NOT EXISTS listings_seller ON listings(seller) WHERE status='open';
CREATE TABLE IF NOT EXISTS requests (
  user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL,
  body TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS lineage (id TEXT PRIMARY KEY, fish TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
  id BIGSERIAL PRIMARY KEY, time BIGINT NOT NULL, user_id TEXT,
  action TEXT NOT NULL, detail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO meta(key,value) VALUES('maintenance','0') ON CONFLICT DO NOTHING;
