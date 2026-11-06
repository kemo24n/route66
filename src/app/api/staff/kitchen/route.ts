import { z } from "zod";
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { publish } from "@/lib/events";

export const dynamic = "force-dynamic";

/** tickets for the kitchen / bar screen, grouped by order */
export const GET = handle(async (req: Request) => {
  await requirePerm(["kitchen", "pos"]);
  const station = new URL(req.url).searchParams.get("station");
  const since = new Date(Date.now() - 20 * 60000);
  const OI = schema.orderItems;
  const stationCond = station === "KITCHEN" || station === "BAR" ? eq(OI.station, station) : undefined;
  const rows = await db.select().from(OI).where(and(
    or(inArray(OI.status, ["NEW", "PREPARING"]), and(eq(OI.status, "READY"), gte(OI.readyAt, since))),
    stationCond,
  )).orderBy(asc(OI.sentAt));
  const orderIds = [...new Set(rows.map((r) => r.orderId))];
  const ords = orderIds.length ? await db.select().from(schema.orders).where(inArray(schema.orders.id, orderIds)) : [];
  const tbls = await db.select({ id: schema.tables.id, label: schema.tables.label }).from(schema.tables);
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const tickets = orderIds.map((oid) => {
    const o = ords.find((x) => x.id === oid)!;
    const its = rows.filter((r) => r.orderId === oid);
    return {
      orderId: oid, number: o?.number, type: o?.type, table: tbls.find((t) => t.id === o?.tableId)?.label ?? null,
      waiter: users.find((u) => u.id === o?.waiterId)?.name ?? null, notes: o?.notes,
      firstSentAt: its[0]?.sentAt,
      items: its.map((i) => ({ id: i.id, name: i.nameAr, qty: i.qty, notes: i.notes, status: i.status, station: i.station, sentAt: i.sentAt, fromQr: i.fromQr })),
    };
  }).filter((t) => t.number != null);
  return ok({ tickets, now: new Date() });
});

const Patch = z.object({ ids: z.array(z.string()).min(1).max(100), status: z.enum(["PREPARING", "READY", "NEW"]) });

export const PATCH = handle(async (req: Request) => {
  await requirePerm(["kitchen", "pos"]);
  const b = Patch.parse(await req.json());
  const OI = schema.orderItems;
  const allowedFrom = b.status === "PREPARING" ? ["NEW", "READY"] : b.status === "READY" ? ["NEW", "PREPARING"] : ["READY", "PREPARING"];
  const up = await db.update(OI).set({ status: b.status, readyAt: b.status === "READY" ? new Date() : null })
    .where(and(inArray(OI.id, b.ids), inArray(OI.status, allowedFrom as ("NEW" | "PREPARING" | "READY")[]))).returning({ orderId: OI.orderId });
  publish("kitchen", "changed", {});
  if (b.status === "READY" && up.length) publish("floor", "ready", { orderIds: [...new Set(up.map((u) => u.orderId))] });
  return ok({ updated: up.length });
});
