import { openDB } from "./db.js";
const db = await openDB();
await db.close();
console.log("Database migrations complete");
