export type Role = "OWNER" | "MANAGER" | "ACCOUNTANT" | "CASHIER" | "WAITER" | "KITCHEN";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "المالك",
  MANAGER: "مدير",
  ACCOUNTANT: "محاسب",
  CASHIER: "كاشير",
  WAITER: "ويتر",
  KITCHEN: "مطبخ / بار",
};

export type Perm =
  | "floor" | "pos" | "checkout" | "kitchen" | "requests" | "bookings" | "bookings.manage"
  | "accounting" | "shifts" | "menu" | "settings" | "tables" | "users" | "risk" | "void";

const ALL: Perm[] = ["floor", "pos", "checkout", "kitchen", "requests", "bookings", "bookings.manage", "accounting", "shifts", "menu", "settings", "tables", "users", "risk", "void"];

export const PERMS: Record<Role, Perm[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== "users"),
  ACCOUNTANT: ["accounting", "shifts", "menu", "settings", "bookings"],
  CASHIER: ["floor", "pos", "checkout", "requests", "bookings", "bookings.manage", "shifts"],
  WAITER: ["floor", "pos", "requests", "bookings"],
  KITCHEN: ["kitchen"],
};

export const can = (role: Role | undefined | null, p: Perm) => !!role && PERMS[role]?.includes(p);

export const HOME_FOR: Record<Role, string> = {
  OWNER: "/staff",
  MANAGER: "/staff",
  ACCOUNTANT: "/staff/accounting",
  CASHIER: "/staff/floor",
  WAITER: "/staff/floor",
  KITCHEN: "/staff/kitchen",
};
