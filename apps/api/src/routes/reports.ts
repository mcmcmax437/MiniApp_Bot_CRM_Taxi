import type { FastifyInstance } from "fastify";
import { ownerId } from "./helpers.js";
import { buildDriverIncomeReport, buildPartnerSettlementReport, buildReportSummary } from "../services/reports.js";
import { buildReminders } from "../services/reminders.js";

function parseRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromRaw = typeof query.from === "string" ? query.from : defaultFrom.toISOString().slice(0, 10);
  const toRaw = typeof query.to === "string" ? query.to : now.toISOString().slice(0, 10);

  // Date-only query params (YYYY-MM-DD) — match expense/payment storage (UTC day bounds).
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)
    ? new Date(`${fromRaw}T00:00:00.000Z`)
    : new Date(fromRaw);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toRaw)
    ? new Date(`${toRaw}T23:59:59.999Z`)
    : new Date(toRaw);
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

  app.get("/reports/partner-settlement", async (req) => {
    const { from, to } = parseRange(req.query as Record<string, unknown>);
    return buildPartnerSettlementReport(ownerId(req), from, to);
  });

  app.get("/reminders", async (req) => {
    return buildReminders(ownerId(req));
  });
}
