# TableTally — Multi-Outlet Restaurant Manager

A production-shaped full-stack app for running a multi-outlet restaurant
business: daily sales entry with a +/- quantity cart, a real admin/executive
role system, outlet isolation enforced on the server, expenses, vendor bills,
DB-driven reports, and an audit log.

**Stack:** Next.js 14 (App Router) + TypeScript, Tailwind CSS, PostgreSQL via
Drizzle ORM, JWT cookie auth (bcrypt + jose), Recharts.

> Prisma was the original plan but its query-engine binaries can't be fetched
> in some locked-down build environments. Drizzle ORM is pure TypeScript (no
> native binary to download), works identically with Supabase/Neon/RDS/local
> Postgres, and is a first-class fit for Vercel's serverless functions — so
> that's what this project uses.

---

## 1. Architecture

```
app/
  admin/                 Admin pages (dashboard, outlets, executives, dishes,
                          sales, bills, expenses, reports, audit logs, settings)
  executive/              Executive pages (dashboard, today's entry, history,
                          reports, profile)
  login/                 Login page
  api/                   Route Handlers — one folder per resource, all with
                          server-side auth + role checks + zod validation
db/
  schema.ts              Drizzle schema (source of truth for the DB)
  migrations/            Generated SQL migrations (drizzle-kit)
  index.ts               Pooled DB client (node-postgres)
  migrate.ts, seed.ts    CLI scripts (run with tsx)
lib/
  auth.ts, session.ts, api-auth.ts   Password hashing, JWT sessions, route guards
  date-ranges.ts          Today/Yesterday/This Week/.../Custom/All Time, timezone-aware
  money.ts, csv.ts, audit.ts, ids.ts, utils.ts
components/
  ui/                    Small hand-rolled component kit (button, card, modal,
                          toast, states...) — no external UI framework needed
  AdminShell / ExecutiveShell, OutletContext, Filters, QuantityStepper, KpiCard
middleware.ts             Edge middleware protecting /admin and /executive
```

### Data model

`daily_entries` + `daily_entry_items` **are** the sales record: one row per
outlet per day, with line items for each dish sold that day. That's exactly
what the "Today's Entry" +/- cart submits, so a separate `sales`/`sale_items`
pair would have just duplicated the same data — see the comment block at the
top of `db/schema.ts` for the full reasoning. All money columns are
`numeric(_, 2)` (never float); IDs are app-generated UUIDs so no Postgres
extension is required.

### Auth & role enforcement

- Passwords are hashed with bcrypt; sessions are signed JWTs in an `httpOnly`
  cookie (12h expiry).
- `middleware.ts` blocks page access by role before a page ever renders.
- **Every** API route re-checks the role server-side too — the UI hiding a
  button is never the only protection.
- Executives are pinned to their assigned outlet in `lib/api-auth.ts`
  (`resolveOutletScope`): whatever `outletId` a request claims, an executive's
  requests are always forced to their own outlet. This is enforced for every
  write (daily entries, expenses) and every read. I tested this directly:
  logging in as an executive and submitting a request with a different
  outlet's ID in the body still only ever wrote to their real outlet — the
  spoofed ID was silently ignored server-side.
- Executives can create/edit a day's entry for **today or yesterday only**
  (`EXECUTIVE_EDIT_WINDOW_DAYS` in `app/api/daily-entries/route.ts`); admins
  can edit any date. An admin can also **lock** a day's entry, after which
  only an admin can change it.
- Resubmitting the same outlet+day updates the same row (there's a DB unique
  constraint on `outlet_id, entry_date`) — this is what prevents accidental
  duplicate daily submissions.

### Dashboard / reports math

Every KPI, chart, and report row is a live query against Postgres — nothing
is hardcoded. Date ranges (Today/Yesterday/This Week/Last Week/This
Month/Last Month/Custom/All Time) are computed in `lib/date-ranges.ts` in the
`Asia/Kolkata` timezone (so "today" matches the restaurant's clock even
though servers run in UTC). Percent-change KPIs compare against the
immediately preceding period of equal length, and are only shown when a prior
period actually has data — otherwise the field is `null` and the UI omits it
rather than showing a fabricated percentage.

---

## 2. Local development

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and JWT_SECRET
npm run db:generate       # generate SQL migrations from db/schema.ts (only needed after schema changes)
npm run db:migrate        # apply migrations to your database
npm run db:seed           # load realistic demo data (3 outlets, dishes, 35 days of sales, expenses, bills)
npm run dev                # http://localhost:3000
```

Demo logins after seeding:

| Role | Email | Password | Outlet |
|---|---|---|---|
| Admin | admin@tabletally.test | Admin@12345 | — |
| Executive | priya@tabletally.test | Exec@12345 | Connaught Place |
| Executive | rahul@tabletally.test | Exec@12345 | Saket |
| Executive | amit@tabletally.test | Exec@12345 | Noida |

`npm run db:seed` **wipes and reloads** all data — only run it against a
database you're OK resetting (demo/dev, not a live production DB).

Don't have Postgres locally? Easiest path is a free Supabase project — see
below, and point your local `.env` at it too.

---

## 3. Deploying (Supabase + Vercel)

### 3.1 Create the database (Supabase)

1. Create a project at https://supabase.com (free tier is enough to try this).
2. **Project Settings → Database → Connection string → "Transaction pooler"**
   (port 6543) — this is the one that works from serverless functions. Copy
   it; it looks like:
   `postgresql://postgres.xxxxxxxx:[PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`
3. Append `?sslmode=require` if it isn't already on the string.
4. From your machine (with `.env` pointed at this URL):
   ```bash
   npm run db:migrate
   npm run db:seed        # optional — skip this for a real launch, run it only to demo
   ```

### 3.2 Deploy the app (Vercel)

1. Push this project to a GitHub repo, then **Import Project** in Vercel.
2. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` — the same Supabase pooled connection string
   - `JWT_SECRET` — a long random string (`openssl rand -base64 48`), **different
     from any value used in development**
3. Build command: `next build` (default). Output: default Next.js. No other
   config needed — deploy.
4. Log in with the seeded admin account (or create your real accounts and
   remove/rotate the demo ones — see below).

### 3.3 Before real, non-demo use

- Change or remove the seeded demo accounts (`admin@tabletally.test` etc.) —
  create your own admin via the database directly for the first login, or
  temporarily reuse the seed script logic in `db/seed.ts` as a reference.
- Rotate `JWT_SECRET` to a value only you have.
- Do **not** run `npm run db:seed` again against a database with real data —
  it deletes everything first.

---

## 4. What's deliberately out of scope

To keep this a real, testable app rather than a sprawling half-finished one,
a few things from the brief were simplified — each is a small, contained
addition if you need it later:

- **Bill/receipt file attachments**: the `bills.attachmentUrl` column exists,
  but there's no upload UI wired to it yet — that needs an object-storage
  service (e.g. Supabase Storage) connected.
- **Excel export**: reports export as CSV (opens fine in Excel); a native
  `.xlsx` export would use a library like `exceljs` in the CSV route.
- **Tax/GST**: `settings.taxPercent` is stored and editable in Admin →
  Settings, but isn't applied to entry totals anywhere yet, since the brief
  didn't specify how tax should affect the cart math — wire it into the
  `daily-entries` POST handler's total calculation if your outlets charge it.
- **"Total Orders/Entries" KPI**: the brief's example dashboard shows a large
  "Total Orders" number, but this system doesn't have a concept of individual
  customer orders — only day-level sales entries per outlet. The dashboard
  reports **Total Entries** (how many outlet-days have data in range) instead
  of inventing an orders concept the schema doesn't support.
- **Bills** are treated as an admin/back-office function (vendor purchases),
  not something executives create, since the brief listed it under Admin's
  capabilities and only conditionally ("if permitted") for executives —
  executives can add **expenses** for their own outlet instead.

## 5. Verified during development

Rather than just writing this and hoping, I actually ran it: installed
dependencies, stood up a real Postgres instance, ran the migrations against
it, seeded realistic data, built the app (`next build`, full TypeScript
check, zero errors), started the server, and exercised it with real HTTP
requests — admin and executive login, wrong-password rejection, unauthenticated
API access rejection, the outlet-tampering security case described above,
duplicate-submission prevention, admin lock/unlock, executive edit-window
rejection, negative-quantity rejection, CSV export, audit log entries, and
role-based page redirects for both roles. Every admin and executive page also
loads successfully (HTTP 200) for its respective role.
