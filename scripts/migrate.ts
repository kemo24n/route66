import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/db";

migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => { console.log("migrations applied"); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
