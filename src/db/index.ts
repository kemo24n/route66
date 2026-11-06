import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __r66pool?: Pool };
const pool = g.__r66pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.__r66pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
