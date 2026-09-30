import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bot, InlineKeyboard } from "grammy";

dotenv.config();
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("Missing BOT_TOKEN");
}
const botToken: string = token;
const publicUrl = process.env.PUBLIC_URL ?? "http://localhost:5173";
const superAdminId = process.env.TELEGRAM_SUPERADMIN_ID ?? "0";

const bot = new Bot(botToken);

const messages = {
  start: [
    "🚕 <b>Taxi Fleet Manager</b>",
    "",
    "Manage your rental cars, drivers, payments and expenses right inside Telegram.",
    "",
    "Tap the button below to open the app.",
  ].join("\n"),
  pendingNote:
    "If this is your first time, your account will be in <i>pending</i> state until the administrator activates it.",
  help: [
    "<b>Commands</b>",
    "/start — open the mini app",
    "/app — open the mini app",
    "/id — show your Telegram ID",
    "/help — this message",
    "",
    "Activated fleet owners can also send a plain message:",
    "Прошивка Сузукі 450 — expense",
    "+550 5132 — income (cash rent) for the car and its driver that day",
  ].join("\n"),
};

function appKeyboard(): InlineKeyboard {
  return new InlineKeyboard().webApp("📊 Open app", publicUrl);
}

bot.command(["start", "app"], async (ctx) => {
  await ctx.reply(`${messages.start}\n\n${messages.pendingNote}`, {
    parse_mode: "HTML",
    reply_markup: appKeyboard(),
  });
});

bot.command("help", async (ctx) => {
  await ctx.reply(messages.help, { parse_mode: "HTML" });
});

bot.command("id", async (ctx) => {
  const id = ctx.from?.id;
  const isAdmin = String(id) === String(superAdminId);
  await ctx.reply(
    `Your Telegram ID: <code>${id}</code>${isAdmin ? "\n\n✅ You are the configured super-admin." : ""}`,
    { parse_mode: "HTML" },
  );
});

const apiUrl = (process.env.API_INTERNAL_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? "3000"}`).replace(
  /\/$/,
  "",
);

type LedgerChoice = { index: number; label: string };
type LedgerResult =
  | { status: "saved"; text: string }
  | { status: "choose"; text: string; token: string; choices: LedgerChoice[] }
  | { status: "rejected"; text: string };

async function postLedger(path: string, body: unknown): Promise<LedgerResult> {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-bot-token", botToken);
  const response = await fetch(`${apiUrl}/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await response.json().catch(() => null)) as LedgerResult | null;
  if (!response.ok || !payload || !("status" in payload)) {
    throw new Error(`ledger_${response.status}`);
  }
  return payload;
}

function choiceKeyboard(result: Extract<LedgerResult, { status: "choose" }>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const choice of result.choices) {
    keyboard.text(choice.label, `led:${result.token}:${choice.index}`).row();
  }
  return keyboard;
}

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return;
  if (ctx.chat.type !== "private") return;
  const fromId = ctx.from?.id;
  if (!fromId) return;

  await ctx.replyWithChatAction("typing");
  try {
    const result = await postLedger("/bot/ledger", {
      telegramUserId: String(fromId),
      text,
      unixSeconds: ctx.message.date,
    });
    if (result.status === "choose") {
      await ctx.reply(result.text, { reply_markup: choiceKeyboard(result) });
      return;
    }
    await ctx.reply(result.text);
  } catch (err) {
    console.error("ledger message failed", err);
    await ctx.reply("Could not save that. Try again in a moment.");
  }
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const match = /^led:([a-f0-9]{12}):(\d+)$/.exec(data);
  const fromId = ctx.from?.id;
  if (!match || !fromId) {
    await ctx.answerCallbackQuery();
    return;
  }
  await ctx.answerCallbackQuery();
  try {
    const result = await postLedger("/bot/ledger/confirm", {
      telegramUserId: String(fromId),
      token: match[1],
      index: Number(match[2]),
    });
    const text = result.text;
    if (ctx.callbackQuery.message) {
      await ctx.editMessageText(text);
      return;
    }
    await ctx.reply(text);
  } catch (err) {
    console.error("ledger confirm failed", err);
    await ctx.reply("Could not save that. Try again in a moment.");
  }
});

bot.on("message", async (ctx) => {
  if (ctx.message.text) return;
  await ctx.reply("Open the app to manage your fleet:", { reply_markup: appKeyboard() });
});

async function configureChatMenu(): Promise<void> {
  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Open app", web_app: { url: publicUrl } },
    });
  } catch (err) {
    console.warn("Failed to set chat menu button:", err);
  }
}

async function main(): Promise<void> {
  await bot.init();
  await configureChatMenu();
  console.log(`Bot @${bot.botInfo.username} started. Mini App URL: ${publicUrl}`);
  await bot.start({ onStart: (info) => console.log(`Listening as @${info.username}`) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
