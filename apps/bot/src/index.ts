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
const publicUrl = process.env.PUBLIC_URL ?? "http://localhost:5173";
const superAdminId = process.env.TELEGRAM_SUPERADMIN_ID ?? "0";

const bot = new Bot(token);

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

bot.on("message", async (ctx) => {
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
