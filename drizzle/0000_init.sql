CREATE TYPE "public"."block_type" AS ENUM('PHONE', 'IP', 'DEVICE');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('ONLINE', 'PHONE', 'WALKIN');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'REVIEW', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('DRAFT', 'NEW', 'PREPARING', 'READY', 'SERVED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('OPEN', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('DINE_IN', 'TAKEAWAY');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('CASH_SYP', 'CASH_USD', 'SHAM_CASH', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('OPEN', 'ACK', 'DONE', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('CALL_WAITER', 'BILL', 'ORDER');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'WAITER', 'KITCHEN');--> statement-breakpoint
CREATE TYPE "public"."table_shape" AS ENUM('ROUND', 'RECT');--> statement-breakpoint
CREATE TYPE "public"."station" AS ENUM('KITCHEN', 'BAR');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "block_type" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"party_size" integer NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"table_id" text,
	"status" "booking_status" NOT NULL,
	"source" "booking_source" DEFAULT 'ONLINE' NOT NULL,
	"notes" text,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" "risk_level" DEFAULT 'LOW' NOT NULL,
	"risk_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"device_id" text,
	"hold_until" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"seated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"no_shows" integer DEFAULT 0 NOT NULL,
	"cancellations" integer DEFAULT 0 NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_id" text,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"order_id" text NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer NOT NULL,
	"service_charge" integer NOT NULL,
	"tax" integer NOT NULL,
	"total" integer NOT NULL,
	"tax_percent" double precision NOT NULL,
	"service_percent" double precision NOT NULL,
	"usd_rate" double precision NOT NULL,
	"cashier_id" text,
	"shift_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"category_id" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"desc_ar" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"image" text,
	"available" boolean DEFAULT true NOT NULL,
	"station" "station" DEFAULT 'KITCHEN' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name_ar" text NOT NULL,
	"unit_price" integer NOT NULL,
	"qty" integer NOT NULL,
	"notes" text,
	"station" "station" NOT NULL,
	"status" "item_status" DEFAULT 'DRAFT' NOT NULL,
	"from_qr" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"day" text NOT NULL,
	"type" "order_type" DEFAULT 'DINE_IN' NOT NULL,
	"status" "order_status" DEFAULT 'OPEN' NOT NULL,
	"table_id" text,
	"waiter_id" text,
	"guests" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"discount" integer DEFAULT 0 NOT NULL,
	"booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"method" "pay_method" NOT NULL,
	"amount" integer NOT NULL,
	"original_amount" double precision NOT NULL,
	"currency" text NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"old_price" integer NOT NULL,
	"new_price" integer NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_model" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"weights" jsonb NOT NULL,
	"bias" double precision NOT NULL,
	"samples" integer DEFAULT 0 NOT NULL,
	"accuracy" double precision,
	"trained_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"type" "request_type" NOT NULL,
	"status" "request_status" DEFAULT 'OPEN' NOT NULL,
	"payload" jsonb,
	"note" text,
	"device_id" text,
	"ip" text,
	"handled_by_id" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"restaurant_name" text DEFAULT 'Route 66' NOT NULL,
	"phone" text DEFAULT '0962022020' NOT NULL,
	"whatsapp" text DEFAULT '963962022020' NOT NULL,
	"address_ar" text DEFAULT 'حلب - الموكامبو - سنتر الاتحاد' NOT NULL,
	"currency_label" text DEFAULT 'ل.س' NOT NULL,
	"tax_percent" double precision DEFAULT 0 NOT NULL,
	"service_percent" double precision DEFAULT 0 NOT NULL,
	"usd_rate" double precision DEFAULT 110 NOT NULL,
	"open_time" text DEFAULT '10:00' NOT NULL,
	"close_time" text DEFAULT '01:00' NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"booking_duration_min" integer DEFAULT 120 NOT NULL,
	"max_party_size" integer DEFAULT 12 NOT NULL,
	"max_days_ahead" integer DEFAULT 14 NOT NULL,
	"min_lead_minutes" integer DEFAULT 30 NOT NULL,
	"pending_hold_minutes" integer DEFAULT 45 NOT NULL,
	"no_show_grace_minutes" integer DEFAULT 20 NOT NULL,
	"risk_auto_confirm_below" integer DEFAULT 35 NOT NULL,
	"risk_review_above" integer DEFAULT 70 NOT NULL,
	"booking_enabled" boolean DEFAULT true NOT NULL,
	"qr_ordering_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opening_cash" integer DEFAULT 0 NOT NULL,
	"counted_cash" integer,
	"expected_cash" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"zone_id" text NOT NULL,
	"label" text NOT NULL,
	"seats" integer NOT NULL,
	"shape" "table_shape" DEFAULT 'RECT' NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"w" integer DEFAULT 90 NOT NULL,
	"h" integer DEFAULT 90 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"bookable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"qr_token" text NOT NULL,
	CONSTRAINT "dining_tables_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 1000 NOT NULL,
	"height" integer DEFAULT 640 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiter_id_users_id_fk" FOREIGN KEY ("waiter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "block_type_value" ON "block_entries" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "bookings_phone_idx" ON "bookings" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "bookings_ip_idx" ON "bookings" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "bookings_device_idx" ON "bookings" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "order_items_status_idx" ON "order_items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_day_number" ON "orders" USING btree ("day","number");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "service_requests" USING btree ("status");