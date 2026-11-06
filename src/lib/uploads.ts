import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// Uploaded menu photos live outside the build (Next only serves /public files that existed at build time).
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");

export async function saveImage(dataUrl: string | undefined | null, key: string) {
  if (!dataUrl?.startsWith("data:image/")) return undefined;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!m) return undefined;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safe = key.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "item";
  const file = `${safe}-${Date.now()}.${ext}`;
  await writeFile(join(UPLOAD_DIR, file), Buffer.from(m[2], "base64"));
  return `/api/uploads/${file}`;
}
