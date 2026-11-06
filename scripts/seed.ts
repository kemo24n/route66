/**
 * npm run db:seed            -> menu, floor plan, staff accounts, settings
 * SEED_DEMO=1 npm run db:seed -> also 6 weeks of demo bookings + sales so dashboards and the risk model have data
 * SEED_RESET=1               -> wipes everything first
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { extractFeatures, scoreBooking, PRIOR_WEIGHTS, PRIOR_BIAS } from "../src/lib/risk-core";
import { retrainModel } from "../src/lib/risk";
import { fromLocal, addDays, localDateStr, localParts, businessDay, addMinutes } from "../src/lib/time";

type SrcItem = { category: string; id: string; name_en: string; name_ar: string; description_ar: string; photo: string | null };

const CATEGORIES = [
  { key: "burger", nameAr: "برغر", nameEn: "Burger" },
  { key: "meals", nameAr: "وجبات", nameEn: "Meals" },
  { key: "sandwich", nameAr: "ساندويش", nameEn: "Sandwich" },
  { key: "salad", nameAr: "سلطات", nameEn: "Salad" },
  { key: "starters", nameAr: "مقبلات", nameEn: "Starters" },
  { key: "drinks", nameAr: "مشروبات", nameEn: "Drinks" },
  { key: "sweets", nameAr: "حلويات", nameEn: "Sweets" },
];

// Starting prices in new Syrian lira. The owner sets the real ones from the dashboard.
const BASE_PRICE: Record<string, number> = { burger: 950, meals: 1050, sandwich: 750, salad: 700, starters: 450, drinks: 300, sweets: 550 };
const PRICE_OVERRIDE: Record<string, number> = {
  "caesar-salad": 700, "cordon-bleu": 1050, "escalope-route": 1000, "beef-steak-burger": 1150, "route-66-beef": 1050,
  "classic-beef-burger": 900, "french-fries": 300, "garlic-bread": 300, "route-66-station-mix": 900, "espresso-romano": 220,
  "cafe-latte": 300, "cappuccino": 280, "hot-chocolate": 320, "chocolate-milkshake": 400, "mojito": 350, "fajita-30cm": 850,
  "tawoq-30cm": 800, "mexican-30cm": 850, "special-cake-route66": 650, "fruit-tart": 500, "brownies": 550,
};

async function reset() {
  await db.execute(sql`truncate table payments, invoices, expenses, shifts, order_items, orders, service_requests, bookings, customers, block_entries, risk_model, price_changes, menu_items, categories, dining_tables, zones, audit_logs, users, settings restart identity cascade`);
}

function token() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
}

async function seedBase() {
  await db.insert(schema.settings).values({ id: 1, taxPercent: 0, servicePercent: 0, usdRate: 110 }).onConflictDoNothing();

  const pw = (p: string) => bcrypt.hashSync(p, 10);
  const staff = [
    { name: "إدارة روت", username: "owner", role: "OWNER" as const, pass: "route66" },
    { name: "المدير", username: "manager", role: "MANAGER" as const, pass: "route66" },
    { name: "المحاسب", username: "accountant", role: "ACCOUNTANT" as const, pass: "route66" },
    { name: "الكاشير", username: "cashier", role: "CASHIER" as const, pass: "route66" },
    { name: "أحمد", username: "waiter1", role: "WAITER" as const, pass: "route66" },
    { name: "سامر", username: "waiter2", role: "WAITER" as const, pass: "route66" },
    { name: "المطبخ", username: "kitchen", role: "KITCHEN" as const, pass: "route66" },
  ];
  for (const u of staff) {
    await db.insert(schema.users).values({ name: u.name, username: u.username, role: u.role, passwordHash: pw(u.pass) }).onConflictDoNothing();
  }

  const catIds: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await db.insert(schema.categories).values({ ...c, sort: i }).onConflictDoUpdate({ target: schema.categories.key, set: { nameAr: c.nameAr, nameEn: c.nameEn, sort: i } }).returning();
    catIds[c.key] = row.id;
  }

  const src = JSON.parse(readFileSync(join(__dirname, "menu-source.json"), "utf8")) as { items: SrcItem[] };
  for (const [i, it] of src.items.entries()) {
    const price = PRICE_OVERRIDE[it.id] ?? BASE_PRICE[it.category] ?? 800;
    const image = it.photo ? `/menu/${it.photo.split("/").pop()}` : null;
    await db.insert(schema.menuItems).values({
      key: it.id, categoryId: catIds[it.category], nameAr: it.name_ar, nameEn: it.name_en, descAr: it.description_ar || "",
      price, image, station: it.category === "drinks" || it.category === "sweets" ? "BAR" : "KITCHEN", sort: i,
    }).onConflictDoNothing();
  }

  const existing = await db.select().from(schema.zones);
  if (existing.length === 0) {
    // layout follows the hand-drawn plan: tables 1-5 inside the room, 10-17 outside the entrance
    const [hall] = await db.insert(schema.zones).values({ name: "الصالة", sort: 0, width: 960, height: 1080 }).returning();
    const hallTables = [
      { label: "1", seats: 4, shape: "RECT", x: 740, y: 330, w: 90, h: 80 },
      { label: "2", seats: 2, shape: "ROUND", x: 750, y: 195, w: 80, h: 80 },
      { label: "3", seats: 4, shape: "RECT", x: 740, y: 60, w: 90, h: 80 },
      { label: "4", seats: 4, shape: "RECT", x: 190, y: 310, w: 100, h: 90 },
      { label: "5", seats: 4, shape: "RECT", x: 160, y: 130, w: 100, h: 100 },
      { label: "10", seats: 4, shape: "RECT", x: 740, y: 580, w: 100, h: 90 },
      { label: "11", seats: 4, shape: "RECT", x: 750, y: 740, w: 100, h: 90 },
      { label: "12", seats: 8, shape: "RECT", x: 700, y: 890, w: 180, h: 110 },
      { label: "13", seats: 2, shape: "ROUND", x: 400, y: 620, w: 90, h: 90 },
      { label: "14", seats: 4, shape: "RECT", x: 410, y: 800, w: 90, h: 110 },
      { label: "15", seats: 4, shape: "RECT", x: 100, y: 600, w: 100, h: 110 },
      { label: "16", seats: 6, shape: "RECT", x: 90, y: 760, w: 140, h: 100 },
      { label: "17", seats: 6, shape: "RECT", x: 100, y: 910, w: 140, h: 100 },
    ] as const;
    for (const t of hallTables) await db.insert(schema.tables).values({ ...t, zoneId: hall.id, qrToken: token() });
  }
}

/* ---------------- demo data ---------------- */

const FIRST = ["محمد", "أحمد", "رنا", "لين", "عمر", "سارة", "يزن", "نور", "خالد", "ريم", "باسل", "هبة", "علي", "مايا", "طارق", "دانة", "حسام", "جود", "كرم", "شهد"];
const LAST = ["حلبي", "قباني", "شامي", "سعيد", "عيسى", "حداد", "نجار", "خطيب", "أيوبي", "ملا", "سواس", "جابري"];
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: readonly T[]) => a[rnd(a.length)];
const phone = () => `09${pick(["3", "4", "5", "6", "8", "9"])}${String(10000000 + rnd(89999999)).slice(0, 7)}`;

async function seedDemo() {
  const tbls = await db.select().from(schema.tables);
  const items = await db.select().from(schema.menuItems);
  const users = await db.select().from(schema.users);
  const cashier = users.find((u) => u.role === "CASHIER")!;
  const waiters = users.filter((u) => u.role === "WAITER");
  const today = localDateStr(new Date());

  // regular customers and a few bad actors
  const regulars = Array.from({ length: 45 }, () => ({ name: `${pick(FIRST)} ${pick(LAST)}`, phone: phone(), flake: Math.random() < 0.12 }));
  const fakers = [
    { name: "asdfgh", phone: "0999999999" }, { name: "تجربة", phone: "0912345678" }, { name: "xx", phone: "0911111111" },
    { name: "ابو علي", phone: "0944 555 55" }, { name: "qwerty", phone: "123456" },
  ];
  const custIds = new Map<string, string>();
  const ensureCustomer = async (name: string, ph: string) => {
    if (custIds.has(ph)) return custIds.get(ph)!;
    const [c] = await db.insert(schema.customers).values({ name, phone: ph }).onConflictDoUpdate({ target: schema.customers.phone, set: { name } }).returning();
    custIds.set(ph, c.id);
    return c.id;
  };
  const hist = new Map<string, { completed: number; noShows: number; cancellations: number }>();

  let code = 1000;
  for (let d = -42; d <= -1; d++) {
    const date = addDays(today, d);
    const n = 6 + rnd(9);
    for (let i = 0; i < n; i++) {
      const isFake = Math.random() < 0.1;
      const person = isFake ? { ...pick(fakers), flake: true } : pick(regulars);
      const time = pick(["13:00", "14:30", "19:00", "20:00", "20:30", "21:00", "21:30", "22:00"]);
      const startAt = fromLocal(date, time);
      const party = isFake ? pick([6, 8, 10, 4]) : pick([2, 2, 3, 4, 4, 5, 6]);
      const table = pick(tbls.filter((t) => t.seats >= party)) ?? tbls[0];
      const h = hist.get(person.phone) ?? { completed: 0, noShows: 0, cancellations: 0 };
      const createdAt = addMinutes(startAt, -(isFake ? 20 + rnd(60) : 120 + rnd(2880)));
      const cp = localParts(createdAt);
      const sp = localParts(startAt);
      const f = extractFeatures({
        name: person.name, phoneRaw: person.phone, partySize: party, startAt, now: createdAt, localDow: sp.dow, localHour: sp.h,
        createdLocalHour: isFake && Math.random() < 0.4 ? 3 : cp.h, elapsedMs: isFake ? 3000 + rnd(5000) : 25000 + rnd(60000),
        history: h, activeSamePhone: isFake ? rnd(3) : 0, ipCount24h: isFake ? 2 + rnd(4) : 1, deviceCount24h: isFake ? 2 + rnd(3) : 1,
        distinctPhonesOnDeviceOrIp: isFake ? 1 + rnd(3) : 1, sameSlotDupes: isFake ? rnd(2) : 0,
      });
      const risk = scoreBooking(f, { weights: PRIOR_WEIGHTS, bias: PRIOR_BIAS }, { autoConfirmBelow: 35, reviewAbove: 70 });
      const noShow = isFake ? Math.random() < 0.9 : person.flake ? Math.random() < 0.5 : Math.random() < 0.04;
      const status = noShow ? "NO_SHOW" : "COMPLETED";
      noShow ? h.noShows++ : h.completed++;
      hist.set(person.phone, h);
      const customerId = await ensureCustomer(person.name, person.phone);
      await db.insert(schema.bookings).values({
        code: `R66-D${code++}`, customerId, name: person.name, phone: person.phone, partySize: party, startAt, endAt: addMinutes(startAt, 120),
        tableId: table.id, status, features: f, riskScore: risk.score, riskLevel: risk.level, riskReasons: risk.reasons, createdAt, closedAt: addMinutes(startAt, 120),
        ip: isFake ? "185.12.4.77" : `10.0.${rnd(255)}.${rnd(255)}`, deviceId: isFake ? "dev-fake-1" : `dev-${rnd(1e9)}`,
      });
    }
  }
  for (const [ph, h] of hist) {
    await db.update(schema.customers).set(h).where(sql`${schema.customers.phone} = ${ph}`);
  }

  // sales for the last 21 days
  for (let d = -21; d <= -1; d++) {
    const day = addDays(today, d);
    const [shift] = await db.insert(schema.shifts).values({ userId: cashier.id, openedAt: fromLocal(day, "10:00"), closedAt: fromLocal(addDays(day, 1), "01:30"), openingCash: 50000 }).returning();
    const nOrders = 25 + rnd(30);
    let cashTotal = 0;
    for (let k = 1; k <= nOrders; k++) {
      const at = addMinutes(fromLocal(day, "12:00"), rnd(12 * 60));
      const t = pick(tbls);
      const [o] = await db.insert(schema.orders).values({
        number: k, day: businessDay(at), type: Math.random() < 0.15 ? "TAKEAWAY" : "DINE_IN", status: "PAID", tableId: t.id,
        waiterId: pick(waiters).id, guests: 1 + rnd(5), createdAt: at, closedAt: addMinutes(at, 50 + rnd(60)),
      }).onConflictDoNothing().returning();
      if (!o) continue;
      const lines = 2 + rnd(5);
      let subtotal = 0;
      for (let j = 0; j < lines; j++) {
        const it = pick(items);
        const qty = 1 + (Math.random() < 0.25 ? 1 : 0);
        subtotal += it.price * qty;
        await db.insert(schema.orderItems).values({ orderId: o.id, menuItemId: it.id, nameAr: it.nameAr, unitPrice: it.price, qty, station: it.station, status: "SERVED", sentAt: at, readyAt: addMinutes(at, 12 + rnd(15)), createdAt: at });
      }
      const [inv] = await db.insert(schema.invoices).values({ orderId: o.id, subtotal, discount: 0, serviceCharge: 0, tax: 0, total: subtotal, taxPercent: 0, servicePercent: 0, usdRate: 110, cashierId: cashier.id, shiftId: shift.id, createdAt: o.closedAt! }).returning();
      const method = pick(["CASH_SYP", "CASH_SYP", "CASH_SYP", "SHAM_CASH", "CASH_USD"] as const);
      if (method === "CASH_SYP") cashTotal += subtotal;
      await db.insert(schema.payments).values({ invoiceId: inv.id, method, amount: subtotal, originalAmount: method === "CASH_USD" ? subtotal / 110 : subtotal, currency: method === "CASH_USD" ? "USD" : "SYP", createdAt: o.closedAt! });
    }
    const exp = 15000 + rnd(30000);
    await db.insert(schema.expenses).values({ shiftId: shift.id, userId: cashier.id, category: pick(["خضار", "غاز", "تنظيف", "صيانة"]), amount: exp, createdAt: fromLocal(day, "16:00") });
    await db.update(schema.shifts).set({ expectedCash: 50000 + cashTotal - exp, countedCash: 50000 + cashTotal - exp - (rnd(3) === 0 ? 2000 : 0) }).where(sql`${schema.shifts.id} = ${shift.id}`);
  }

  const r = await retrainModel();
  console.log("risk model trained on demo history:", r);
}

async function main() {
  if (process.env.SEED_RESET === "1") await reset();
  await seedBase();
  if (process.env.SEED_DEMO === "1") await seedDemo();
  console.log("seed done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
