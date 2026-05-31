import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "./env.js";
import { runReminderJob } from "./services/reminders.js";
import { sendTelegramMessage } from "./notify.js";

export function startScheduler(log: FastifyBaseLogger): void {
  if (!cron.validate(env.reminderCron)) {
    log.error(`Invalid REMINDER_CRON expression: ${env.reminderCron}`);
    return;
  }
  cron.schedule(env.reminderCron, () => {
    log.info("Running reminder job");
    runReminderJob(sendTelegramMessage, (msg, meta) => log.info({ meta }, msg)).catch((err) =>
      log.error({ err }, "Reminder job failed"),
    );
  });
  log.info(`Reminder scheduler started (cron: ${env.reminderCron})`);
}
