import { openDB, transaction } from "../backend/db.js";
import { setMaintenance } from "../backend/game.js";
if (!["on", "off"].includes(process.argv[2]))
  throw Error("Usage: node scripts/maintenance.js on|off");
const db = openDB();
transaction(db, () => setMaintenance(db, process.argv[2] === "on"));
db.close();
console.log("Maintenance " + process.argv[2]);
