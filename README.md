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

Then open **four terminals** (keep each running):

```bash
npm run dev:db        # 1. zero-install local PostgreSQL (downloads once, then stays up)
npm run db:push -w @taxi/api   # 2. create the tables (run once, in any terminal)
npm run seed                   #    optional: add demo car/driver/payment
npm run dev:api       # 3. the API   (http://localhost:3000)
npm run dev:miniapp   # 4. the Mini App (http://localhost:5173)
```

Open **http://localhost:5173** in your browser. With `DEV_BYPASS_AUTH=true` you are
logged in as a local super-admin and can use every screen. The Vite dev server
proxies `/api` to `http://localhost:3000`.

> The local database lives in `apps/api/.localdb` (git-ignored). Delete that folder
> to reset all local data. You do not need to run the bot for browser testing.

### Testing inside real Telegram (optional)

Telegram only opens Mini Apps over HTTPS. To try it for real, expose your local
Mini App with a tunnel and point the bot at it:

```bash
# example with cloudflared (or use ngrok):
cloudflared tunnel --url http://localhost:5173
```

Set `PUBLIC_URL` to the HTTPS tunnel URL, set the same URL as the Web App URL in
BotFather, set `DEV_BYPASS_AUTH=false`, restart `dev:api` and `dev:bot`, then open
the app from your bot. Your own Telegram ID (from `/id`) should be in
`TELEGRAM_SUPERADMIN_ID` so you are auto-activated.

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
