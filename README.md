# Taxi Fleet Manager — Telegram Mini App (Multi-Tenant SaaS)

A Telegram Mini App for running a car-rental-to-taxi-drivers business: manage cars,
drivers, rent agreements, payments, balances ("who owes what"), expenses, reminders
and reports — all inside Telegram. Built as a multi-tenant SaaS so you can grant
access to other car owners, each with fully isolated data.

## Stack

- **Bot**: [grammY](https://grammy.dev) (long polling)
- **API**: [Fastify](https://fastify.dev) + [Prisma](https://www.prisma.io) + PostgreSQL
- **Mini App**: React + Vite + [@telegram-apps/telegram-ui](https://github.com/Telegram-Mini-Apps/TelegramUI), i18n (UK/RU/EN)
- **Shared**: TypeScript types + zod schemas (`packages/shared`)
- **Deploy**: Docker Compose + Caddy (automatic HTTPS) on a VPS

```
apps/
  api/       Fastify REST API, Prisma schema, reminder scheduler
  bot/       grammY Telegram bot
  miniapp/   React Mini App (served as static files by Caddy)
packages/
  shared/    Shared enums, zod schemas, response types
```

## 1. Create the bot (BotFather)

1. Open [@BotFather](https://t.me/BotFather) → `/newbot` → follow prompts → copy the **token**.
2. Set the Mini App: `/newapp` (or `/setmenubutton`) and point the **Web App URL** to your
   public HTTPS domain (e.g. `https://taxi.example.com`). The bot also sets the chat menu
   button automatically on startup.
3. Find your own numeric Telegram ID: message your bot and send `/id`. Put it in
   `TELEGRAM_SUPERADMIN_ID` — this account becomes the **super-admin** that activates
   other owners and is auto-activated itself.

> Telegram Mini Apps require **HTTPS**. For local UI work you can run the dev server, but
> `initData` authentication only works when the app is opened from within Telegram over HTTPS.

## 2. Configure environment

```bash
cp .env.example .env
# then edit .env and fill in BOT_TOKEN, TELEGRAM_SUPERADMIN_ID, PUBLIC_URL, DOMAIN, DB password
```

## 3. Run with Docker (recommended for the VPS)

```bash
docker compose up -d --build
```

This starts PostgreSQL, the API (which syncs the DB schema via `prisma db push` on boot),
the bot, and Caddy (HTTPS + static Mini App + `/api` reverse proxy). Point your domain's
DNS A record at the VPS first so Caddy can issue a certificate.

Optionally seed demo data for the super-admin owner:

```bash
docker compose exec api npm run seed -w @taxi/api
```

## 4. Local testing (no Docker, no Telegram)

You can run and test everything on your machine in a normal browser. A real
PostgreSQL is downloaded automatically the first time (no install needed), and a
dev auth bypass lets you open the app without Telegram.

```bash
npm install
npm run prisma:generate

# 1) Copy the example env. It already enables local testing defaults:
#    DEV_BYPASS_AUTH=true and a localhost DATABASE_URL.
cp .env.example .env          # then set DEV_BYPASS_AUTH=true
```

Then run everything with **one command**:

```bash
npm run dev
```

This starts the local PostgreSQL (downloads once), syncs the schema, the API
(`http://localhost:3000`), and the Mini App (`http://localhost:5173`). Open the
Mini App URL in your browser. Press Ctrl+C in that terminal to stop all services.

Optional demo data (run once):

```bash
npm run seed
```

> The local database lives in `apps/api/.localdb` (git-ignored). Delete that folder
> to reset all local data. You do not need to run the bot or install PostgreSQL
> manually for browser testing.

### Browse the database in Beekeeper Studio

While `npm run dev` is running, add a **PostgreSQL** connection in Beekeeper:

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5432` |
| User | `taxi` |
| Password | `taxi` |
| Database | `taxi` |
| SSL | off / disable |

Then expand: **taxi → Schemas → public → Tables**. You will see tables such as
`Owner`, `Car`, `Driver`, `Payment`, `Expense`, etc. Double-click a table to view
and edit rows. Use the SQL tab to run queries (e.g. `SELECT * FROM "Car";`).

Note: Prisma uses quoted PascalCase table names, so in SQL use `"Car"` not `car`.

### Testing inside Telegram (local — no deploy)

Telegram Mini Apps **must** be opened over **HTTPS**. You do not need a VPS yet —
run everything on your PC and expose it with a free tunnel while you work.

#### One-time setup in @BotFather

1. Create a bot (or use your existing one) → copy the **token** into `.env` as `BOT_TOKEN`.
2. Find your numeric Telegram ID (message [@userinfobot](https://t.me/userinfobot)) → put it in
   `.env` as `TELEGRAM_SUPERADMIN_ID` (you will be auto-activated as super-admin).
3. **Menu button → Configure → Web App** — set the URL to your tunnel HTTPS address
   (see below; you update this each dev session unless you use a fixed ngrok domain).

#### Each dev session (terminal on = bot on, Ctrl+C = everything stops)

**Terminal 1** — app + database + bot:

```bash
npm run dev:telegram
```

**Terminal 2** — HTTPS tunnel (keep open):

```bash
# One-time: sign up at ngrok.com, then:
npm run ngrok:auth -- YOUR_TOKEN

npm run dev:tunnel
```

The script auto-saves the URL to `.env` and syncs the Telegram menu button via the Bot API.
Also paste the URL in @BotFather → Menu button → Web App if needed.

Set `DEV_BYPASS_AUTH=false` in `.env`. Restart **Terminal 1** after the tunnel URL is set.
Open your bot in Telegram → `/start` → **Open app** (use the newest button only).

| Mode | Command | Where it opens |
|------|---------|----------------|
| Browser only (no Telegram) | `npm run dev` | http://localhost:5173, `DEV_BYPASS_AUTH=true` |
| Real Telegram | `npm run dev:telegram` + tunnel | Inside Telegram app |

When you are happy with the app, deploy to the VPS with Docker (section 3). Until then, nothing
needs to be published.

## 5. Production / VPS deployment

For production, use the Docker workflow in section 3 above (`docker compose up -d --build`),
which provisions PostgreSQL, the API, the bot, and Caddy (automatic HTTPS) together. Keep
`DEV_BYPASS_AUTH=false` in production.

## How it works

- **Multi-tenancy**: every table has an `ownerId`. The API derives the owner from the
  validated Telegram `initData` and scopes all queries to that owner. New owners are
  created as `PENDING`.
- **Access control**: the super-admin opens the **Admin** tab to `Activate`/`Suspend`
  owners. `subscriptionExpiresAt` is reserved for adding paid subscriptions later.
- **Balances**: `balance = accrued rent (from active agreements) - rent paid + unpaid fines`.
  A positive balance means the driver owes you.
- **Reminders**: a daily cron (`REMINDER_CRON`) inside the API finds expiring
  insurance/inspection and overdue drivers and sends each owner a Telegram summary.

## Roadmap (from the plan)

- Phase 2: fines & shifts UI, document photo upload, Google Sheets / CSV import, charts.
- Phase 3: driver self-service login, automated Telegram subscription billing, online rent collection.
