import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handle, fail } from "@/lib/http";
import { requirePerm } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** SVG QR code that opens the table page. ?rotate=1 issues a new token (old printed QR stops working) */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  await requirePerm("tables");
  const { id } = await params;
  const url = new URL(req.url);
  let [t] = await db.select().from(schema.tables).where(eq(schema.tables.id, id));
  if (!t) return fail(404, "الطاولة مو موجودة");
  if (url.searchParams.get("rotate") === "1") {
    const qrToken = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
    [t] = await db.update(schema.tables).set({ qrToken }).where(eq(schema.tables.id, id)).returning();
  }
  const base = process.env.PUBLIC_URL || `${url.protocol}//${url.host}`;
  const svg = await QRCode.toString(`${base}/t/${t.qrToken}`, { type: "svg", margin: 1, color: { dark: "#084607", light: "#ffffff" }, errorCorrectionLevel: "M" });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
});
