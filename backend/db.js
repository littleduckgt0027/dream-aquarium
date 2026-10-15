import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDB(path = process.env.DB_PATH || "data/aquarium.sqlite") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,recovery TEXT NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS listings(id TEXT PRIMARY KEY,seller TEXT NOT NULL REFERENCES users(id),fish TEXT NOT NULL,type TEXT NOT NULL,price INTEGER NOT NULL,buyout INTEGER,end_at INTEGER,bid INTEGER NOT NULL DEFAULT 0,bidder TEXT,status TEXT NOT NULL DEFAULT 'open');
 CREATE TABLE IF NOT EXISTS requests(user_id TEXT NOT NULL,key TEXT NOT NULL,body TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,key));
 CREATE TABLE IF NOT EXISTS lineage(id TEXT PRIMARY KEY,fish TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,time INTEGER NOT NULL,user_id TEXT,action TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 INSERT OR IGNORE INTO meta VALUES('maintenance','0');
 PRAGMA user_version=1;`);
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
