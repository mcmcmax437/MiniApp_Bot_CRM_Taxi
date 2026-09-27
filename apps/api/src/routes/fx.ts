import type { FastifyInstance } from "fastify";
import { Currency } from "@taxi/shared";
import { getFxRate } from "../services/fx.js";

const CURRENCIES = new Set<string>(Object.values(Currency));

export async function fxRoutes(app: FastifyInstance): Promise<void> {
  app.get("/fx/rate", async (req, reply) => {
    const q = req.query as { from?: string; to?: string };
    const from = (q.from ?? "").toUpperCase();
    const to = (q.to ?? "").toUpperCase();
    if (!CURRENCIES.has(from) || !CURRENCIES.has(to)) {
      return reply.code(400).send({ error: "invalid_currency" });
    }
    try {
      return await getFxRate(from as Currency, to as Currency);
    } catch (err) {
      req.log.warn({ err, from, to }, "fx rate fetch failed");
      return reply.code(502).send({ error: "fx_unavailable" });
    }
  });
}
