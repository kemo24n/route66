import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { publish } from "@/lib/events";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm("tables");
  const zones = await db.select().from(schema.zones).orderBy(asc(schema.zones.sort));
  const tables = await db.select().from(schema.tables).where(eq(schema.tables.active, true));
  return ok({ zones, tables });
});

const T = z.object({
  id: z.string().optional(), zoneId: z.string(), label: z.string().trim().min(1).max(10), seats: z.number().int().min(1).max(40),
  shape: z.enum(["ROUND", "RECT"]), x: z.number().int(), y: z.number().int(), w: z.number().int().min(40).max(600), h: z.number().int().min(40).max(600),
  rotation: z.number().int().min(0).max(359).default(0), bookable: z.boolean().default(true),
});
const Body = z.object({
  zones: z.array(z.object({ id: z.string().optional(), tempId: z.string().optional(), name: z.string().trim().min(1).max(30), sort: z.number().int(), width: z.number().int().min(300).max(3000), height: z.number().int().min(300).max(3000) })),
  tables: z.array(T.extend({ zoneId: z.string() })),
});

function token() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
}

/** save the whole floor plan from the editor */
export const PUT = handle(async (req: Request) => {
  const s = await requirePerm("tables");
  const b = Body.parse(await req.json());
  const labels = b.tables.map((t) => t.label);
  if (new Set(labels).size !== labels.length) return fail(400, "في رقم طاولة مكرر");
  if (!b.zones.length) return fail(400, "لازم يكون في قسم واحد عالأقل");

  await db.transaction(async (tx) => {
    const zoneMap = new Map<string, string>();
    const existingZones = await tx.select().from(schema.zones);
    for (const z of b.zones) {
      if (z.id && existingZones.some((e) => e.id === z.id)) {
        await tx.update(schema.zones).set({ name: z.name, sort: z.sort, width: z.width, height: z.height }).where(eq(schema.zones.id, z.id));
        zoneMap.set(z.id, z.id);
      } else {
        const [nz] = await tx.insert(schema.zones).values({ name: z.name, sort: z.sort, width: z.width, height: z.height }).returning();
        zoneMap.set(z.tempId ?? z.id ?? nz.id, nz.id);
      }
    }
    const existing = await tx.select().from(schema.tables);
    const keep = new Set<string>();
    for (const t of b.tables) {
      const zoneId = zoneMap.get(t.zoneId) ?? t.zoneId;
      const vals = { zoneId, label: t.label, seats: t.seats, shape: t.shape, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, bookable: t.bookable, active: true };
      if (t.id && existing.some((e) => e.id === t.id)) {
        await tx.update(schema.tables).set(vals).where(eq(schema.tables.id, t.id));
        keep.add(t.id);
      } else {
        const [nt] = await tx.insert(schema.tables).values({ ...vals, qrToken: token() }).returning();
        keep.add(nt.id);
      }
    }
    // removed tables are deactivated (history keeps working)
    const removed = existing.filter((e) => !keep.has(e.id) && e.active).map((e) => e.id);
    if (removed.length) await tx.update(schema.tables).set({ active: false, label: "x" }).where(inArray(schema.tables.id, removed));
    const zoneIdsKept = new Set(zoneMap.values());
    const tablesLeft = await tx.select({ zoneId: schema.tables.zoneId }).from(schema.tables);
    for (const z of existingZones) {
      if (!zoneIdsKept.has(z.id) && !tablesLeft.some((t) => t.zoneId === z.id)) await tx.delete(schema.zones).where(eq(schema.zones.id, z.id));
    }
  });
  await audit(s.uid, "floor.save", "floor", undefined, { tables: b.tables.length });
  publish("floor", "layout", {});
  return ok({ ok: true });
});
