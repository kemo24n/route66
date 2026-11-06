import { and, desc, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { getModel, retrainModel } from "@/lib/risk";
import { FEATURES, PRIOR_WEIGHTS, REASONS_AR } from "@/lib/risk-core";
import { audit } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requirePerm("risk");
  const m = await getModel();
  const B = schema.bookings;
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const recent = await db.select({ status: B.status, riskLevel: B.riskLevel, riskScore: B.riskScore }).from(B).where(gte(B.startAt, since));
  const byLevel = (lvl: string) => {
    const r = recent.filter((x) => x.riskLevel === lvl && ["COMPLETED", "SEATED", "NO_SHOW"].includes(x.status));
    return { total: r.length, noShows: r.filter((x) => x.status === "NO_SHOW").length };
  };
  const blocked = await db.select().from(schema.blockEntries).orderBy(desc(schema.blockEntries.createdAt)).limit(200);
  const flagged = await db.select().from(B).where(and(inArray(B.status, ["PENDING", "REVIEW"]), gte(B.endAt, new Date()))).orderBy(desc(B.riskScore)).limit(50);
  const [{ n: totalNoShows }] = await db.select({ n: sql<number>`count(*)` }).from(B).where(sql`${B.status} = 'NO_SHOW' and ${B.startAt} >= ${since}`);
  const [{ n: totalDone }] = await db.select({ n: sql<number>`count(*)` }).from(B).where(sql`${B.status} in ('COMPLETED','SEATED','NO_SHOW') and ${B.startAt} >= ${since}`);
  return ok({
    model: { samples: m.samples, accuracy: m.accuracy, trainedAt: m.trainedAt, bias: m.bias },
    features: FEATURES.map((k) => ({ key: k, label: REASONS_AR[k], weight: m.weights[k] ?? PRIOR_WEIGHTS[k], prior: PRIOR_WEIGHTS[k] })).sort((a, b) => b.weight - a.weight),
    last30: { noShowRate: Number(totalDone) ? Number(totalNoShows) / Number(totalDone) : 0, finished: Number(totalDone), LOW: byLevel("LOW"), MEDIUM: byLevel("MEDIUM"), HIGH: byLevel("HIGH") },
    flagged, blocked,
  });
});

export const POST = handle(async () => {
  const s = await requirePerm("risk");
  const r = await retrainModel();
  await audit(s.uid, "risk.retrain", "risk_model", "1", r);
  return ok(r);
});
