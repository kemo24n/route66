import {
  pgTable, pgEnum, text, integer, boolean, timestamp, doublePrecision, jsonb, serial, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const roleEnum = pgEnum("role", ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER", "WAITER", "KITCHEN"]);
export const stationEnum = pgEnum("station", ["KITCHEN", "BAR"]);
export const shapeEnum = pgEnum("table_shape", ["ROUND", "RECT"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING", // medium risk: waiting for WhatsApp/phone confirmation, table held until holdUntil
  "REVIEW", // high risk: staff decides, table NOT held
  "CONFIRMED", "SEATED", "COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED", "EXPIRED",
]);
export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH"]);
export const bookingSourceEnum = pgEnum("booking_source", ["ONLINE", "PHONE", "WALKIN"]);
export const orderTypeEnum = pgEnum("order_type", ["DINE_IN", "TAKEAWAY"]);
export const orderStatusEnum = pgEnum("order_status", ["OPEN", "PAID", "CANCELLED"]);
export const itemStatusEnum = pgEnum("item_status", ["DRAFT", "NEW", "PREPARING", "READY", "SERVED", "VOID"]);
export const payMethodEnum = pgEnum("pay_method", ["CASH_SYP", "CASH_USD", "SHAM_CASH", "CARD"]);
export const requestTypeEnum = pgEnum("request_type", ["CALL_WAITER", "BILL", "ORDER"]);
export const requestStatusEnum = pgEnum("request_status", ["OPEN", "ACK", "DONE", "REJECTED"]);
export const blockTypeEnum = pgEnum("block_type", ["PHONE", "IP", "DEVICE"]);

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: created(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  restaurantName: text("restaurant_name").default("Route 66").notNull(),
  phone: text("phone").default("0962022020").notNull(),
  whatsapp: text("whatsapp").default("963962022020").notNull(),
  addressAr: text("address_ar").default("حلب - الموكامبو - سنتر الاتحاد").notNull(),
  currencyLabel: text("currency_label").default("ل.س").notNull(),
  taxPercent: doublePrecision("tax_percent").default(0).notNull(),
  servicePercent: doublePrecision("service_percent").default(0).notNull(),
  usdRate: doublePrecision("usd_rate").default(110).notNull(), // new SYP per 1 USD
  openTime: text("open_time").default("10:00").notNull(),
  closeTime: text("close_time").default("01:00").notNull(),
  slotMinutes: integer("slot_minutes").default(30).notNull(),
  bookingDurationMin: integer("booking_duration_min").default(120).notNull(),
  maxPartySize: integer("max_party_size").default(12).notNull(),
  maxDaysAhead: integer("max_days_ahead").default(14).notNull(),
  minLeadMinutes: integer("min_lead_minutes").default(30).notNull(),
  pendingHoldMinutes: integer("pending_hold_minutes").default(45).notNull(),
  noShowGraceMinutes: integer("no_show_grace_minutes").default(20).notNull(),
  riskAutoConfirmBelow: integer("risk_auto_confirm_below").default(35).notNull(),
  riskReviewAbove: integer("risk_review_above").default(70).notNull(),
  bookingEnabled: boolean("booking_enabled").default(true).notNull(),
  qrOrderingEnabled: boolean("qr_ordering_enabled").default(true).notNull(),
  // the address customers open (printed inside the table QR codes). empty = use the address the dashboard is opened on
  publicUrl: text("public_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: id(),
  key: text("key").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  sort: integer("sort").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: id(),
  key: text("key").notNull().unique(),
  categoryId: text("category_id").notNull().references(() => categories.id),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  descAr: text("desc_ar").default("").notNull(),
  price: integer("price").notNull(),
  image: text("image"),
  available: boolean("available").default(true).notNull(),
  station: stationEnum("station").default("KITCHEN").notNull(),
  sort: integer("sort").default(0).notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const priceChanges = pgTable("price_changes", {
  id: id(),
  itemId: text("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  oldPrice: integer("old_price").notNull(),
  newPrice: integer("new_price").notNull(),
  userId: text("user_id"),
  createdAt: created(),
});

export const zones = pgTable("zones", {
  id: id(),
  name: text("name").notNull(),
  sort: integer("sort").default(0).notNull(),
  width: integer("width").default(1000).notNull(),
  height: integer("height").default(640).notNull(),
});

export const tables = pgTable("dining_tables", {
  id: id(),
  zoneId: text("zone_id").notNull().references(() => zones.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  seats: integer("seats").notNull(),
  shape: shapeEnum("shape").default("RECT").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  w: integer("w").default(90).notNull(),
  h: integer("h").default(90).notNull(),
  rotation: integer("rotation").default(0).notNull(),
  bookable: boolean("bookable").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  qrToken: text("qr_token").notNull().unique(),
});

export const customers = pgTable("customers", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  completed: integer("completed").default(0).notNull(),
  noShows: integer("no_shows").default(0).notNull(),
  cancellations: integer("cancellations").default(0).notNull(),
  blocked: boolean("blocked").default(false).notNull(),
  blockReason: text("block_reason"),
  notes: text("notes"),
  createdAt: created(),
});

export const bookings = pgTable("bookings", {
  id: id(),
  code: text("code").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  partySize: integer("party_size").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  tableId: text("table_id").references(() => tables.id),
  status: bookingStatusEnum("status").notNull(),
  source: bookingSourceEnum("source").default("ONLINE").notNull(),
  notes: text("notes"),
  riskScore: integer("risk_score").default(0).notNull(),
  riskLevel: riskLevelEnum("risk_level").default("LOW").notNull(),
  riskReasons: jsonb("risk_reasons").$type<string[]>().default([]).notNull(),
  features: jsonb("features").$type<Record<string, number>>().default({}).notNull(),
  ip: text("ip"),
  deviceId: text("device_id"),
  holdUntil: timestamp("hold_until", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  seatedAt: timestamp("seated_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  handledBy: text("handled_by"),
  createdAt: created(),
}, (t) => [index("bookings_start_idx").on(t.startAt), index("bookings_phone_idx").on(t.phone), index("bookings_ip_idx").on(t.ip), index("bookings_device_idx").on(t.deviceId)]);

export const blockEntries = pgTable("block_entries", {
  id: id(),
  type: blockTypeEnum("type").notNull(),
  value: text("value").notNull(),
  reason: text("reason"),
  createdAt: created(),
}, (t) => [uniqueIndex("block_type_value").on(t.type, t.value)]);

export const riskModel = pgTable("risk_model", {
  id: integer("id").primaryKey().default(1),
  weights: jsonb("weights").$type<Record<string, number>>().notNull(),
  bias: doublePrecision("bias").notNull(),
  samples: integer("samples").default(0).notNull(),
  accuracy: doublePrecision("accuracy"),
  trainedAt: timestamp("trained_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: id(),
  number: integer("number").notNull(),
  day: text("day").notNull(),
  type: orderTypeEnum("type").default("DINE_IN").notNull(),
  status: orderStatusEnum("status").default("OPEN").notNull(),
  tableId: text("table_id").references(() => tables.id),
  waiterId: text("waiter_id").references(() => users.id),
  guests: integer("guests").default(1).notNull(),
  notes: text("notes"),
  discount: integer("discount").default(0).notNull(),
  bookingId: text("booking_id"),
  createdAt: created(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("orders_day_number").on(t.day, t.number), index("orders_status_idx").on(t.status)]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id").notNull().references(() => menuItems.id),
  nameAr: text("name_ar").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
  notes: text("notes"),
  station: stationEnum("station").notNull(),
  status: itemStatusEnum("status").default("DRAFT").notNull(),
  fromQr: boolean("from_qr").default(false).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdAt: created(),
}, (t) => [index("order_items_status_idx").on(t.status)]);

export const shifts = pgTable("shifts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCash: integer("opening_cash").default(0).notNull(),
  countedCash: integer("counted_cash"),
  expectedCash: integer("expected_cash"),
  notes: text("notes"),
});

export const invoices = pgTable("invoices", {
  id: id(),
  number: serial("number").notNull().unique(),
  orderId: text("order_id").notNull().unique().references(() => orders.id),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull(),
  serviceCharge: integer("service_charge").notNull(),
  tax: integer("tax").notNull(),
  total: integer("total").notNull(),
  taxPercent: doublePrecision("tax_percent").notNull(),
  servicePercent: doublePrecision("service_percent").notNull(),
  usdRate: doublePrecision("usd_rate").notNull(),
  cashierId: text("cashier_id").references(() => users.id),
  shiftId: text("shift_id").references(() => shifts.id),
  createdAt: created(),
});

export const payments = pgTable("payments", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  method: payMethodEnum("method").notNull(),
  amount: integer("amount").notNull(), // SYP equivalent
  originalAmount: doublePrecision("original_amount").notNull(),
  currency: text("currency").notNull(),
  reference: text("reference"),
  createdAt: created(),
});

export const expenses = pgTable("expenses", {
  id: id(),
  shiftId: text("shift_id").references(() => shifts.id),
  userId: text("user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  createdAt: created(),
});

export const serviceRequests = pgTable("service_requests", {
  id: id(),
  tableId: text("table_id").notNull().references(() => tables.id),
  type: requestTypeEnum("type").notNull(),
  status: requestStatusEnum("status").default("OPEN").notNull(),
  payload: jsonb("payload").$type<{ items?: { menuItemId: string; qty: number; notes?: string }[] }>(),
  note: text("note"),
  deviceId: text("device_id"),
  ip: text("ip"),
  handledById: text("handled_by_id"),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("requests_status_idx").on(t.status)]);

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  userId: text("user_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  data: jsonb("data"),
  createdAt: created(),
});

export const menuItemsRelations = relations(menuItems, ({ one }) => ({ category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }) }));
export const categoriesRelations = relations(categories, ({ many }) => ({ items: many(menuItems) }));
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  waiter: one(users, { fields: [orders.waiterId], references: [users.id] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({ order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }) }));
export const tablesRelations = relations(tables, ({ one }) => ({ zone: one(zones, { fields: [tables.zoneId], references: [zones.id] }) }));
export const zonesRelations = relations(zones, ({ many }) => ({ tables: many(tables) }));
export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  payments: many(payments),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({ invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }) }));

export type Setting = typeof settings.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type DiningTable = typeof tables.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
