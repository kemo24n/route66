import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { getSettings, audit } from "@/lib/settings";
import { publicBase, isLocalAddress } from "@/lib/publicUrl";

export const dynamic = "force-dynamic";

/** tables with their QR links for the QR page */
export const GET = handle(async (req: Request) => {
  await requirePerm("tables");
  const s = await getSettings();
  const base = publicBase(req, s);
  const zones = await db.select().from(schema.zones).orderBy(asc(schema.zones.sort));
  const tables = await db.select().from(schema.tables).where(eq(schema.tables.active, true));
  tables.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  return ok({
    base, saved: s.publicUrl ?? null, local: isLocalAddress(base),
    tables: tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats, zone: zones.find((z) => z.id === t.zoneId)?.name ?? "", token: t.qrToken, path: `/t/${t.qrToken}` })),
  });
});

const Body = z.object({ tableId: z.string() });

/** issue a new code for a table (the old printed card stops working) */
export const POST = handle(async (req: Request) => {
  const s = await requirePerm("tables");
  const { tableId } = Body.parse(await req.json());
  const qrToken = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
  const [t] = await db.update(schema.tables).set({ qrToken }).where(eq(schema.tables.id, tableId)).returning();
  if (!t) return fail(404, "الطاولة مو موجودة");
  await audit(s.uid, "qr.rotate", "table", tableId, { label: t.label });
  return ok({ token: qrToken, path: `/t/${qrToken}` });
});
