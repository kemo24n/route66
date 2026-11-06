import { handle, ok } from "@/lib/http";
import { requirePerm } from "@/lib/auth";
import { publicMenu } from "@/lib/menu";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  await requirePerm(["pos", "menu"]);
  const s = await getSettings();
  return ok({ categories: await publicMenu(true), currency: s.currencyLabel, usdRate: s.usdRate });
});
