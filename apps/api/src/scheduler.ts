import cron from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import { env } from "./env.js";
import { runReminderJob, runWeeklyMileageJob } from "./services/reminders.js";
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
  cron.schedule("0 9 * * 1", () => {
    log.info("Running weekly mileage reminder job");
    runWeeklyMileageJob(sendTelegramMessage, (msg, meta) => log.info({ meta }, msg)).catch((err) =>
      log.error({ err }, "Weekly mileage job failed"),
    );
  });
  log.info(`Reminder scheduler started (cron: ${env.reminderCron})`);
}
