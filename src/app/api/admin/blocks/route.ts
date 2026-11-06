import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/settings";
import { normalizeSyPhone } from "@/lib/risk-core";

const Body = z.object({ type: z.enum(["PHONE", "IP", "DEVICE"]), value: z.string().trim().min(3).max(80), reason: z.string().max(150).optional() });

export const POST = handle(async (req: Request) => {
  const s = await requirePerm("risk");
  const b = Body.parse(await req.json());
  const value = b.type === "PHONE" ? normalizeSyPhone(b.value).phone : b.value;
  await db.insert(schema.blockEntries).values({ ...b, value }).onConflictDoNothing();
  if (b.type === "PHONE") await db.update(schema.customers).set({ blocked: true, blockReason: b.reason ?? "محظور" }).where(eq(schema.customers.phone, value));
  await audit(s.uid, "block.add", "block", value, b);
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const s = await requirePerm("risk");
  const b = Body.pick({ type: true, value: true }).parse(await req.json());
  await db.delete(schema.blockEntries).where(and(eq(schema.blockEntries.type, b.type), eq(schema.blockEntries.value, b.value)));
  if (b.type === "PHONE") await db.update(schema.customers).set({ blocked: false, blockReason: null }).where(eq(schema.customers.phone, b.value));
  await audit(s.uid, "block.remove", "block", b.value, b);
  return ok({ ok: true });
});
