# Route 66 · Restaurant System

Built by Solunera for Route 66 Café & Restaurant (Aleppo, Mogambo, Al Etihad Center).
Arabic-first (RTL), works on phones, tablets and desktop.

## What's inside

**For customers**
- `/` home page and `/menu`: the real Route 66 menu with dish photos (66 items, 7 categories)
- `/book`: online booking. The customer picks people, day and time, then **chooses the table on an interactive map** of the hall and terrace. Busy tables are greyed out and the best-fit table is starred.
- `/book/R66-XXXXXX`: booking status page (confirm by WhatsApp, cancel)
- `/t/<token>`: page opened from the **QR code on each table**: menu, "call waiter", "bring the bill", and ordering from the phone

**For staff** (`/staff`, every role sees only its own screens)
- **Floor** (live): every table with its order, ready food, upcoming booking and calls from the table
- **POS**: add items, notes, send to kitchen, void (manager only, reason required), discount, split payment
- **Kitchen / bar screen**: live tickets with timers and sound, split into kitchen and bar
- **Calls**: waiter calls, bill requests and phone orders from the tables
- **Bookings**: day view, risk score with reasons, customer history, confirm, seated, no-show, fake, block, phone bookings
- **Accounting**: reports (sales per day, payment methods, top items, categories, peak hours, CSV export), invoices with 80mm receipt printing, shifts with cash-drawer count, expenses
- **Menu & prices**: edit any price inline, raise or lower prices by % in one go (when the dollar moves), price history, photos, availability on/off
- **Floor-plan editor**: drag tables, add zones, change seats/shape/size/rotation, print QR cards
- **Fake-booking detection** dashboard, model training, block list
- **Staff accounts** and an audit log of every sensitive action
- **Settings**: USD rate, tax %, service %, opening hours, booking rules, risk thresholds

Payments: cash lira, cash dollar (converted at the rate in settings), Sham Cash, card. Split payment and change are handled; change always comes off lira cash so the drawer count stays right.

## Fake bookings and fake orders

This was the owner's main worry, so it gets its own section.

**Bookings.** Every online booking gets a risk score from 0 to 100 before it can hold a table.
1. Hard stops: blocked phone / device / IP, invalid Syrian mobile, too many bookings from one device or network in an hour, and a hidden honeypot field that only bots fill.
2. 17 signals: fake-looking number (0999999999, 0912345678), nonsense name, the customer's past no-shows and cancellations, other active bookings on the same number, many bookings from the same device or network, the same device using several phone numbers, two tables at the same time, form filled in a few seconds, booking made at 3am, very large party, peak slot, very short or very far lead time.
3. A logistic-regression model turns the signals into a probability. It starts from hand-set weights and **retrains on Route 66's own history** (who showed up, who didn't, what staff marked as fake), pulled back toward the starting weights so a small history can't break it.
4. What happens:
   - low score: confirmed instantly
   - medium: table held for 45 minutes, the customer confirms by WhatsApp, otherwise the table frees itself
   - high: goes to staff review and does **not** hold the table
5. Staff see the reasons in plain Arabic on each booking and can mark it no-show / fake / fake + block. Each mark makes the next training better.

**Orders from the table QR.** Nothing reaches the kitchen directly. The waiter gets the order, checks someone is really sitting there, and accepts it. A device with 3 rejected requests is blocked. Each table has its own secret QR token (it can be re-issued if a code leaks), there's one open call per type per table, and rate limits per device and network.

## Logins (change the passwords before going live)

| user | role | password |
|---|---|---|
| owner | Owner (everything) | route66 |
| manager | Manager | route66 |
| accountant | Accountant | route66 |
| cashier | Cashier | route66 |
| waiter1, waiter2 | Waiter | route66 |
| kitchen | Kitchen / bar | route66 |

## Run it locally

Needs Node 20+ and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate            # create tables
npm run db:seed               # menu, photos, floor plan, staff accounts
SEED_DEMO=1 npm run db:seed   # optional: 6 weeks of demo bookings + sales for the pitch
npm run build && npm start    # http://localhost:3000
```

For a clean database without demo data: `SEED_RESET=1 npm run db:seed` (this **wipes everything**).

## Deploy

**Docker (any VPS):**
```bash
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env
echo "DB_PASSWORD=$(openssl rand -hex 12)" >> .env
echo "PUBLIC_URL=https://your-domain" >> .env
echo "COOKIE_SECURE=1" >> .env
docker compose up -d --build
```

**Render:** `render.yaml` is ready (web service + Postgres + a disk for uploaded photos). Set `PUBLIC_URL` to the real domain, because it's printed inside the table QR codes.

The start command runs migrations and the base seed every time. That's safe: it never overwrites the owner's prices, menu edits or floor plan.

Live screens (kitchen, floor, calls) use Server-Sent Events from a single server. If you ever run more than one instance behind a load balancer, move `src/lib/events.ts` to Postgres LISTEN/NOTIFY or Redis.

## Before going live with Route 66

1. **Prices:** the seed uses starting prices (Caesar 700, Cordon Bleu 1050, Escalope 1000 came from their Instagram; the rest are placeholders). Enter the owner's list in *Menu & prices*.
2. **Real floor plan:** photograph the place and redraw it in *Floor-plan editor*. Then *Print QR* and put a card on each table.
3. **Settings:** USD rate, tax, service, opening hours, WhatsApp number for confirmations.
4. **Passwords:** change every default password in *Staff*.
5. Six items have no photo yet (Diner Beef, Route 66 Beef, Grilled Chicken, French Fries, Cordon Bleu, Escalope Route). Add them from the edit dialog.

## Not included yet

- **Sham Cash API:** today Sham Cash is recorded as a payment method with an optional transaction reference. Automatic confirmation needs Sham Cash's merchant API credentials; the hook is `src/app/api/staff/orders/[id]/checkout/route.ts`.
- **Inventory / ERP link:** left out on purpose (the owner said only prices matter). Prices are managed here.
- **Order tracking for customers:** removed from scope as agreed.

## Tests

```bash
npm test                      # unit tests: risk engine, money, time zone, slots
npm run test:e2e              # 46 end-to-end checks against a running server (creates rows: use a test DB)
```

## Code map

```
src/db/schema.ts          database tables (Drizzle ORM, PostgreSQL)
src/lib/risk-core.ts      fake-booking model (pure, unit-tested)
src/lib/risk.ts           collects the signals from the DB + training
src/lib/bookings.ts       slots, table availability, holds, expiry
src/lib/time.ts           Aleppo time (UTC+3), business day flips at 05:00
src/app/api/public/*      customer APIs (menu, booking, table QR)
src/app/api/staff/*       floor, orders, kitchen, calls, bookings, accounting
src/app/api/admin/*       settings, menu, floor plan, users, risk, QR
src/app/(pages)           customer pages, /staff/* staff screens
scripts/seed.ts           Route 66 menu, floor plan, accounts, demo data
```

Powered by Solunera · @soluneragency
"# route66" 
