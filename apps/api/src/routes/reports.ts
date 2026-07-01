import type { FastifyInstance } from "fastify";
import { ownerId } from "./helpers.js";
import { buildDriverIncomeReport, buildReportSummary } from "../services/reports.js";
import { buildReminders } from "../services/reminders.js";

function parseRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = typeof query.from === "string" ? new Date(query.from) : defaultFrom;
  const to = typeof query.to === "string" ? new Date(query.to) : now;
  // include the whole "to" day
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reports/summary", async (req) => {
    const { from, to } = parseRange(req.query as Record<string, unknown>);
    return buildReportSummary(ownerId(req), from, to);
  });

  app.get("/reports/driver-income", async (req) => {
    const { from, to } = parseRange(req.query as Record<string, unknown>);
    return buildDriverIncomeReport(ownerId(req), from, to);
  });

  app.get("/reminders", async (req) => {
    return buildReminders(ownerId(req));
  });
}
