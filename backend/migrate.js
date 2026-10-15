import { openDB } from "./db.js";
const db = openDB();
db.close();
console.log("Database migration v1 complete");
