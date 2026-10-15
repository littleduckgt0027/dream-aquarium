import { openDB, transaction } from "../backend/db.js";
import { setMaintenance } from "../backend/game.js";
if (!["on", "off"].includes(process.argv[2]))
  throw Error("Usage: node scripts/maintenance.js on|off");
const db = await openDB();
await transaction(
  db,
  async () => await setMaintenance(db, process.argv[2] === "on"),
);
await db.close();
console.log("Maintenance " + process.argv[2]);
