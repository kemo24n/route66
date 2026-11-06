import { EventEmitter } from "events";

// Realtime bus for one server instance. Screens subscribe through /api/stream (SSE).
// Channels: kitchen, floor, requests, bookings
export type Channel = "kitchen" | "floor" | "requests" | "bookings";

const g = globalThis as unknown as { __r66bus?: EventEmitter };
export const bus = g.__r66bus ?? new EventEmitter();
bus.setMaxListeners(500);
g.__r66bus = bus;

export function publish(channel: Channel, type: string, data: Record<string, unknown> = {}) {
  bus.emit("event", { channel, type, data, at: Date.now() });
}
