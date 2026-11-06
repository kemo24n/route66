import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { PERMS } from "@/lib/roles";

export async function GET() {
  const s = await getSession();
  if (!s) return fail(401, "not signed in");
  return ok({ ...s, perms: PERMS[s.role] });
}
