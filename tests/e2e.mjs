// End-to-end check against a running server: BASE=http://localhost:3000 node tests/e2e.mjs
// Needs the seeded database (npm run db:seed). Creates real rows: run it on a test database.
import pg from "pg";

const BASE = process.env.BASE || "http://localhost:3000";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
let pass = 0, failN = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log("  ✓", msg); } else { failN++; console.log("  ✗", msg, extra ?? ""); } };

async function call(path, { method, body, cookie, ip } = {}) {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
const login = async (u) => (await call("/api/auth/login", { body: { username: u, password: "route66" } })).cookie;
const rid = () => Math.random().toString(36).slice(2, 10);

async function main() {
  await db.connect();
  // pick a date 3 days ahead and an evening slot
  const slots = await call("/api/public/slots?party=2");
  const date = slots.data.dates[3];
  const time = "20:30";

  console.log("\nBooking + fake detection");
  const av = await call(`/api/public/availability?date=${date}&time=${time}&party=2`);
  const free = av.data.tables.filter((t) => t.state === "free");
  ok(free.length > 2, `availability returns free tables (${free.length})`);
  const good = await call("/api/public/bookings", { ip: "10.1.1.1", body: { name: "رامي حداد", phone: "0944 123 457", partySize: 2, date, time, tableId: free[0].id, deviceId: "e2e-" + rid(), elapsedMs: 42000 } });
  ok(good.status === 200 && good.data.status === "CONFIRMED", "clean booking is auto-confirmed", good.data);

  const clash = await call("/api/public/bookings", { ip: "10.1.1.2", body: { name: "سارة عيسى", phone: "0955111222", partySize: 2, date, time, tableId: free[0].id, deviceId: "e2e-" + rid(), elapsedMs: 30000 } });
  ok(clash.status === 409, "same table + same time is refused", clash.status);

  const fakeDev = "e2e-fake-" + rid();
  const fake1 = await call("/api/public/bookings", { ip: "185.12.4.99", body: { name: "asdfgh", phone: "0999999999", partySize: 8, date, time, tableId: av.data.tables.find((t) => t.seats >= 8 && t.state === "free").id, deviceId: fakeDev, elapsedMs: 2500 } });
  ok(fake1.status === 200 && ["REVIEW", "PENDING"].includes(fake1.data.status), `fake-looking booking is held back (${fake1.data.status})`, fake1.data);
  const f1 = (await db.query("select risk_score, risk_level, risk_reasons from bookings where code=$1", [fake1.data.code])).rows[0];
  ok(f1 && f1.risk_score >= 70, `fake booking scored high (${f1?.risk_score})`, f1);
  console.log("    reasons:", f1?.risk_reasons?.join(" | "));

  const fake2 = await call("/api/public/bookings", { ip: "185.12.4.99", body: { name: "محمد", phone: "0933445566", partySize: 2, date, time: "21:00", tableId: free[1].id, deviceId: fakeDev, elapsedMs: 3000 } });
  const f2 = (await db.query("select risk_score from bookings where code=$1", [fake2.data.code])).rows[0];
  ok(fake2.status === 200 && f2.risk_score >= 35, `same device with a new phone gets flagged (${f2?.risk_score})`);

  const invalid = await call("/api/public/bookings", { body: { name: "علي", phone: "12345", partySize: 2, date, time, tableId: free[2].id } });
  ok(invalid.status === 400, "invalid Syrian number is rejected");

  const bot = await call("/api/public/bookings", { body: { name: "bot", phone: "0944000111", partySize: 2, date, time, tableId: free[2].id, website: "http://spam" } });
  const botRow = (await db.query("select 1 from bookings where code=$1", [bot.data.code])).rows.length;
  ok(bot.status === 200 && botRow === 0, "honeypot: bot gets a fake success, nothing saved");

  const st = await call(`/api/public/bookings/${good.data.code}`);
  ok(st.data.status === "CONFIRMED" && st.data.table, "booking status page data");
  const cancelBad = await call(`/api/public/bookings/${good.data.code}`, { body: { phone: "0911000000" } });
  ok(cancelBad.status === 403, "cancel needs the right phone");
  const cancel = await call(`/api/public/bookings/${good.data.code}`, { body: { phone: "0944123457" } });
  ok(cancel.status === 200, "customer cancels with their phone");

  console.log("\nStaff permissions");
  const waiter = await login("waiter1");
  const kitchen = await login("kitchen");
  const cashier = await login("cashier");
  const owner = await login("owner");
  ok(!!waiter && !!kitchen && !!cashier && !!owner, "all roles can log in");
  ok((await call("/api/staff/floor")).status === 401, "floor needs login");
  ok((await call("/api/staff/floor", { cookie: kitchen })).status === 403, "kitchen can't see the floor");
  ok((await call("/api/admin/settings", { cookie: waiter })).status === 403, "waiter can't open settings");
  const bad = await call("/api/auth/login", { body: { username: "owner", password: "nope" } });
  ok(bad.status === 401, "wrong password refused");

  console.log("\nOrder → kitchen → checkout");
  const floor = await call("/api/staff/floor", { cookie: waiter });
  const table = floor.data.tables.find((t) => !t.order);
  const o = await call("/api/staff/orders", { cookie: waiter, body: { tableId: table.id, type: "DINE_IN", guests: 3 } });
  ok(o.status === 200 && o.data.id, `waiter opens order on table ${table.label}`);
  const again = await call("/api/staff/orders", { cookie: waiter, body: { tableId: table.id, type: "DINE_IN", guests: 3 } });
  ok(again.data.id === o.data.id, "second open on same table reuses the order");
  const menu = await call("/api/staff/menu", { cookie: waiter });
  const items = menu.data.categories.flatMap((c) => c.items);
  const burger = items.find((i) => i.key === "classic-beef-burger");
  const latte = items.find((i) => i.key === "cafe-latte");
  await call(`/api/staff/orders/${o.data.id}/items`, { cookie: waiter, body: { menuItemId: burger.id, qty: 2, notes: "بدون بصل" } });
  await call(`/api/staff/orders/${o.data.id}/items`, { cookie: waiter, body: { menuItemId: latte.id, qty: 1 } });
  await call(`/api/staff/orders/${o.data.id}/items`, { cookie: waiter, body: { menuItemId: latte.id, qty: 1 } });
  const ord = await call(`/api/staff/orders/${o.data.id}`, { cookie: waiter });
  ok(ord.data.order.items.length === 2 && ord.data.order.items.find((i) => i.menuItemId === latte.id).qty === 2, "same item stacks into one line");
  ok(ord.data.totals.subtotal === burger.price * 2 + latte.price * 2, `subtotal ${ord.data.totals.subtotal}`);
  const earlyPay = await call(`/api/staff/orders/${o.data.id}/checkout`, { cookie: cashier, body: { payments: [{ method: "CASH_SYP", amount: 999999 }] } });
  ok(earlyPay.status === 400, "can't pay before sending to the kitchen");
  const waiterPay = await call(`/api/staff/orders/${o.data.id}/checkout`, { cookie: waiter, body: { payments: [{ method: "CASH_SYP", amount: 999999 }] } });
  ok(waiterPay.status === 403, "waiter can't take payment");
  const sent = await call(`/api/staff/orders/${o.data.id}/send`, { cookie: waiter, method: "POST" });
  ok(sent.data.sent === 2, "send to kitchen");
  const kds = await call("/api/staff/kitchen?station=KITCHEN", { cookie: kitchen });
  const ticket = kds.data.tickets.find((t) => t.orderId === o.data.id);
  ok(ticket && ticket.items.length === 1 && ticket.items[0].notes === "بدون بصل", "kitchen screen shows the burger with its note (bar item filtered out)");
  const bar = await call("/api/staff/kitchen?station=BAR", { cookie: kitchen });
  ok(bar.data.tickets.some((t) => t.orderId === o.data.id), "bar screen shows the latte");
  const allIds = [...ticket.items, ...bar.data.tickets.find((t) => t.orderId === o.data.id).items].map((i) => i.id);
  const ready = await call("/api/staff/kitchen", { cookie: kitchen, method: "PATCH", body: { ids: allIds, status: "READY" } });
  ok(ready.data.updated === 2, "kitchen marks ready");
  const sentLine = ord.data.order.items[0];
  const voidByWaiter = await call(`/api/staff/order-items/${sentLine.id}`, { cookie: waiter, method: "DELETE", body: { reason: "test" } });
  ok(voidByWaiter.status === 403, "waiter can't void a sent item");

  const s = (await call("/api/admin/settings", { cookie: owner })).data;
  await call("/api/admin/settings", { cookie: owner, method: "PATCH", body: { taxPercent: 5, usdRate: 120 } });
  const ord2 = await call(`/api/staff/orders/${o.data.id}`, { cookie: cashier });
  const sub = ord2.data.totals.subtotal;
  const expected = Math.round(sub - 500 + Math.round((sub - 500) * 0.05));
  const usd = 10;
  const rest = expected - usd * 120;
  const pay = await call(`/api/staff/orders/${o.data.id}/checkout`, { cookie: cashier, body: { discount: 500, payments: [{ method: "CASH_USD", amount: usd }, { method: "SHAM_CASH", amount: rest - 200 }, { method: "CASH_SYP", amount: 1000 }] } });
  ok(pay.status === 200 && pay.data.total === expected, `checkout with discount + 5% tax + USD + Sham Cash (total ${pay.data.total})`, pay.data);
  ok(pay.data.change === 800, `change given back (${pay.data.change})`);
  const inv = await call(`/api/staff/invoices/${pay.data.invoiceId}`, { cookie: cashier });
  const paidSum = inv.data.payments.reduce((a, p) => a + p.amount, 0);
  ok(paidSum === expected, `payments recorded net of change (${paidSum})`);
  const cashLine = inv.data.payments.find((p) => p.method === "CASH_SYP");
  const usdLine = inv.data.payments.find((p) => p.method === "CASH_USD");
  ok(cashLine.amount === 200 && usdLine.amount === 1200, `change comes off the lira cash, dollars kept whole (lira ${cashLine.amount}, usd ${usdLine.amount})`);
  const dbl = await call(`/api/staff/orders/${o.data.id}/checkout`, { cookie: cashier, body: { payments: [{ method: "CASH_SYP", amount: 999999 }] } });
  ok(dbl.status === 400, "can't pay twice");
  await call("/api/admin/settings", { cookie: owner, method: "PATCH", body: { taxPercent: s.taxPercent, usdRate: s.usdRate } });

  console.log("\nTable QR: call waiter + order request");
  const t2 = floor.data.tables.find((t) => !t.order && t.id !== table.id);
  const tok = (await db.query("select qr_token from dining_tables where id=$1", [t2.id])).rows[0].qr_token;
  const dev = "e2e-qr-" + rid();
  const page = await call(`/api/public/table/${tok}?device=${dev}`);
  ok(page.status === 200 && page.data.table.label === t2.label, "QR page opens the right table");
  ok((await call(`/api/public/table/not-a-token`)).status === 404, "unknown QR token refused");
  const c1 = await call(`/api/public/table/${tok}/request`, { body: { type: "CALL_WAITER", deviceId: dev } });
  const c2 = await call(`/api/public/table/${tok}/request`, { body: { type: "CALL_WAITER", deviceId: dev } });
  ok(c1.status === 200 && c2.data.duplicate, "second waiter call is merged into the first");
  const qo = await call(`/api/public/table/${tok}/request`, { body: { type: "ORDER", deviceId: dev, items: [{ menuItemId: burger.id, qty: 1 }, { menuItemId: latte.id, qty: 2, notes: "سكر خفيف" }] } });
  ok(qo.status === 200, "customer sends an order from the table");
  const kBefore = await call("/api/staff/kitchen", { cookie: kitchen });
  ok(!kBefore.data.tickets.some((t) => t.table === t2.label), "QR order does NOT reach the kitchen before a waiter accepts");
  const acc = await call(`/api/staff/requests/${qo.data.id}`, { cookie: waiter, method: "PATCH", body: { action: "accept" } });
  ok(acc.status === 200 && acc.data.orderId, "waiter accepts → order created on the table");
  const kAfter = await call("/api/staff/kitchen", { cookie: kitchen });
  ok(kAfter.data.tickets.some((t) => t.table === t2.label && t.items.some((i) => i.fromQr)), "now it's on the kitchen screen, tagged QR");
  await call(`/api/staff/requests/${c1.data.id}`, { cookie: waiter, method: "PATCH", body: { action: "done" } });
  const devB = "e2e-spam-" + rid();
  for (let i = 0; i < 3; i++) {
    const r = await call(`/api/public/table/${tok}/request`, { body: { type: "ORDER", deviceId: devB, items: [{ menuItemId: burger.id, qty: 1 }] } });
    await call(`/api/staff/requests/${r.data.id}`, { cookie: waiter, method: "PATCH", body: { action: "reject" } });
  }
  const blocked = await call(`/api/public/table/${tok}/request`, { body: { type: "CALL_WAITER", deviceId: devB } });
  ok(blocked.status === 403, "device with 3 rejected requests is blocked");

  console.log("\nQR codes");
  const qrList = await fetch(BASE + "/api/admin/qr-tables", { headers: { Cookie: owner, "x-forwarded-host": "route66.example.com", "x-forwarded-proto": "https" } }).then((r) => r.json());
  ok(qrList.base === "https://route66.example.com" && qrList.local === false, `QR address follows the real domain behind a proxy (${qrList.base})`);
  ok(qrList.tables.length >= 13 && qrList.tables.every((t) => t.path.startsWith("/t/")), `every table has a QR link (${qrList.tables.length})`);
  const qrLocal = await call("/api/admin/qr-tables", { cookie: owner });
  ok(qrLocal.data.local === true, "localhost address is flagged as not reachable from phones");
  const t5 = qrList.tables.find((t) => t.label === "5");
  ok((await call(t5.path)).status === 200 && (await call(`/api/public/table/${t5.token}`)).data.table.label === "5", "scanned link opens table 5's page");
  await call("/api/admin/settings", { cookie: owner, method: "PATCH", body: { publicUrl: "https://route66.sy/" } });
  const qrSaved = await call("/api/admin/qr-tables", { cookie: owner });
  ok(qrSaved.data.base === "https://route66.sy", "saved site address is used (trailing slash removed)");
  const svg = await fetch(BASE + `/api/admin/qr/${t5.id}`, { headers: { Cookie: owner } }).then((r) => r.text());
  ok(svg.startsWith("<svg"), "server QR image still works");
  await call("/api/admin/settings", { cookie: owner, method: "PATCH", body: { publicUrl: "" } });
  const badUrl = await call("/api/admin/settings", { cookie: owner, method: "PATCH", body: { publicUrl: "route66 site" } });
  ok(badUrl.status === 400, "invalid site address refused");
  const rot = await call("/api/admin/qr-tables", { cookie: owner, body: { tableId: t5.id } });
  ok((await call(`/api/public/table/${t5.token}`)).status === 404 && (await call(`/api/public/table/${rot.data.token}`)).status === 200, "re-issued code works, old printed code stops");
  ok((await call("/api/admin/qr-tables", { cookie: waiter })).status === 403, "waiter can't manage QR codes");

  console.log("\nStaff booking actions + training");
  const bks = await call(`/api/staff/bookings?date=${date}`, { cookie: owner });
  const fb = bks.data.bookings.find((b) => b.code === fake1.data.code);
  ok(fb && fb.riskReasons.length > 0, "staff sees risk reasons on the booking");
  const blk = await call(`/api/staff/bookings/${fb.id}`, { cookie: owner, method: "PATCH", body: { action: "block", reason: "e2e" } });
  ok(blk.status === 200, "mark fake + block");
  const again2 = await call("/api/public/bookings", { body: { name: "asdfgh", phone: "0999999999", partySize: 2, date, time: "22:00", tableId: free[3].id, deviceId: "e2e-" + rid(), elapsedMs: 30000 } });
  ok(again2.status === 403, "blocked phone can't book online again");
  const tr = await call("/api/admin/risk", { cookie: owner, method: "POST" });
  ok(tr.status === 200 && tr.data.samples > 0, `retrain model (${tr.data.samples} samples, accuracy ${Math.round((tr.data.accuracy ?? 0) * 100)}%)`);

  console.log("\nReports");
  const rep = await call("/api/staff/reports", { cookie: owner });
  ok(rep.status === 200 && rep.data.summary.invoices >= 1, `today's report (${rep.data.summary.invoices} invoices)`);
  ok((await call("/api/staff/reports", { cookie: cashier })).status === 403, "cashier can't open reports");

  await db.end();
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
