# Taxi Fleet Manager — Telegram Mini App (Multi-Tenant SaaS)

A Telegram Mini App for running a car-rental-to-taxi-drivers business: manage cars,
drivers, rent agreements, payments, balances ("who owes what"), expenses, reminders
and reports — all inside Telegram. Built as a multi-tenant SaaS so you can grant
access to other car owners, each with fully isolated data.

## Stack

- **Bot**: [grammY](https://grammy.dev) (long polling)
- **API**: [Fastify](https://fastify.dev) + [Prisma](https://www.prisma.io) + MySQL
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

This starts MySQL, the API (which applies DB migrations automatically on boot),
the bot, and Caddy (HTTPS + static Mini App + `/api` reverse proxy). Point your domain's
DNS A record at the VPS first so Caddy can issue a certificate.

Optionally seed demo data for the super-admin owner:

```bash
docker compose exec api npm run seed -w @taxi/api
```

## 4. Local testing (Docker + MySQL, no Telegram)

You can run and test everything on your machine in a normal browser. **Docker Desktop**
is required for local dev: `npm run dev` starts MySQL in Docker automatically.
A dev auth bypass lets you open the app without Telegram.

```bash
npm install
npm run prisma:generate

# 1) Copy the example env and set DEV_BYPASS_AUTH=true for browser testing.
#    Database connection is built from MYSQL_* — you do not need DATABASE_URL locally.
cp .env.example .env
```

Then run everything with **one command**:

```bash
npm run dev
```

This starts MySQL in Docker, syncs the schema, the API (`http://localhost:3000`),
and the Mini App (`http://localhost:5173`). Open the Mini App URL in your browser.
Press Ctrl+C to stop the API and Mini App (MySQL keeps running in Docker).

Optional demo data (run once):

```bash
npm run seed
```

> To reset all local data: `docker compose down -v` (removes the MySQL volume).

### MySQL auth error (`sha256_password` / `Unknown authentication plugin`)

If `npm run dev` fails with that message, your local MySQL user must use
`mysql_native_password` (required by Prisma). Run:

```bash
npm run db:auth-help -w @taxi/api
```

Copy the printed SQL into MySQL Workbench or `mysql` CLI as **admin**, then run `npm run dev` again.

### Browse the database in Beekeeper Studio

While `npm run dev` is running, add a **MySQL** connection in Beekeeper:

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `3306` |
| User | `taxi` |
| Password | value from `MYSQL_PASSWORD` in `.env` |
| Database | `taxi` |

You will see tables such as `Owner`, `Car`, `Driver`, `Payment`, `Expense`, etc.
Double-click a table to view
and edit rows. Use the SQL tab to run queries (for example, ``SELECT * FROM `Car`;``).

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

Telegram Mini Apps require **HTTPS** on a real domain. Point your domain's DNS **A** (or **AAAA**)
record at the VPS before requesting a certificate.

### Option A — Git push → VPS (recommended)

**Normal workflow:** commit → `git push` → GitHub Actions SSHs to the VPS → `git pull` → build → PM2 restart.

**One-time server setup** (after the repo is on GitHub):

1. On the VPS, clone the repo and keep `.env` on the server only (never commit `.env`):

   ```bash
   ssh vps
   bash -c "$(curl -fsSL https://raw.githubusercontent.com/mcmcmax437/MiniApp_Bot_CRM_Taxi/main/scripts/vps-git-bootstrap.sh)"
   ```

   Or copy `scripts/vps-git-bootstrap.sh` to the server and run it. It backs up the existing
   `/opt/taxi-crm/.env`, clones the repo, and runs the first build.

2. In GitHub → **Settings → Secrets and variables → Actions**, add:

   | Secret | Example |
   |--------|---------|
   | `VPS_HOST` | `173.242.52.16` |
   | `VPS_USER` | `root` |
   | `VPS_SSH_PRIVATE_KEY` | contents of your private SSH key (the one that can `ssh vps`) |

3. Push to `main`. The workflow `.github/workflows/deploy.yml` runs `scripts/vps-update.sh` on the server.

**Server `.env`** (create once at `/opt/taxi-crm/.env`, production values only):

```env
BOT_TOKEN=...
TELEGRAM_SUPERADMIN_ID=...
DOMAIN=taxi.tereshkovych.com.ua
PUBLIC_URL=https://taxi.tereshkovych.com.ua
CORS_ORIGINS=https://taxi.tereshkovych.com.ua
MYSQL_USER=taxi
MYSQL_PASSWORD=...
MYSQL_DATABASE=taxi
MYSQL_HOST=127.0.0.1
NODE_ENV=production
RUN_SCHEDULER=true
DEV_BYPASS_AUTH=false
VITE_API_BASE=/api
```

4. In @BotFather, set the Mini App / menu button URL to `PUBLIC_URL`.

### Option A2 — Manual deploy from your PC (fallback)

If GitHub Actions is not set up yet:

```bash
npm run deploy:vps        # upload + build (no git)
npm run deploy:vps:ssl    # HTTPS
```

| Command | Purpose |
|---------|---------|
| `git push origin main` | **Preferred** — triggers GitHub deploy |
| `npm run deploy:vps` | Manual fallback (tar upload from PC) |
| `npm run deploy:vps:ssl` | Let's Encrypt HTTPS |

### Option B — Docker Compose + Caddy

If Docker is installed on the VPS, use section 3 (`docker compose up -d --build`). Caddy
provisions HTTPS automatically when `DOMAIN` in `.env` points at the server.

Keep `DEV_BYPASS_AUTH=false` in production for either option.

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
