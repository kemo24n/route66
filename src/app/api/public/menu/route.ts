import { handle, ok } from "@/lib/http";
import { publicMenu } from "@/lib/menu";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const s = await getSettings();
  return ok({ categories: await publicMenu(), currency: s.currencyLabel, usdRate: s.usdRate });
});
