import { bus, type Channel } from "@/lib/events";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events for staff screens. ?channels=kitchen,floor
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response("unauthorized", { status: 401 });
  const wanted = new Set((new URL(req.url).searchParams.get("channels") || "floor").split(",") as Channel[]);
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (e: { channel: Channel }) => {
        if (!wanted.has(e.channel)) return;
        try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { cleanup(); }
      };
      const ping = setInterval(() => { try { ctrl.enqueue(enc.encode(`: ping\n\n`)); } catch { cleanup(); } }, 20000);
      bus.on("event", send);
      ctrl.enqueue(enc.encode(`retry: 3000\n\n`));
      cleanup = () => { clearInterval(ping); bus.off("event", send); };
      req.signal.addEventListener("abort", () => { cleanup(); try { ctrl.close(); } catch {} });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
