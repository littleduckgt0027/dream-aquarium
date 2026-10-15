import pg from "pg";
import { randomUUID } from "node:crypto";
import { openDB, openPostgres, poolConfig } from "../../backend/db.js";

export async function testDatabase() {
  if (!process.env.TEST_DATABASE_URL) return openDB(":memory:");
  const url = new URL(process.env.TEST_DATABASE_URL);
  const schema = "dream_test_" + randomUUID().replaceAll("-", "");
  const admin = new pg.Pool(poolConfig(url.toString()));
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  let db;
  try {
    db = await openPostgres(url.toString());
  } catch (e) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    throw e;
  }
  const close = db.close;
  db.close = async () => {
    await close();
    // Only this randomly named schema created by the test is ever removed.
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  };
  db.testURL = url.toString();
  return db;
}
