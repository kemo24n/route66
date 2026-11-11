import type { Setting } from "@/db/schema";

/** The address printed in QR codes: the saved setting, else the address this request came in on (proxy-aware). */
export function publicBase(req: Request, s: Pick<Setting, "publicUrl">) {
  if (s.publicUrl) return s.publicUrl.replace(/\/+$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || new URL(req.url).host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** true when phones outside this machine / network won't be able to open the address */
export function isLocalAddress(base: string) {
  try {
    const host = new URL(base).hostname;
    return host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "[::1]";
  } catch {
    return true;
  }
}
