import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { confirmLedgerChoice, handleLedgerMessage } from "../services/bot-ledger/handle.js";

function botTokenOk(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return false;
  const provided = Buffer.from(value);
  const expected = Buffer.from(env.botToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function rejectBot(req: FastifyRequest, reply: FastifyReply): boolean {
  if (botTokenOk(req.headers["x-bot-token"])) return false;
  reply.code(401).send({ error: "unauthorized" });
  return true;
}

const messageSchema = z.object({
  telegramUserId: z.string().regex(/^\d+$/),
  text: z.string().trim().min(1).max(500),
  unixSeconds: z.number().int().positive(),
});

const confirmSchema = z.object({
  telegramUserId: z.string().regex(/^\d+$/),
  token: z.string().regex(/^[a-f0-9]{12}$/),
  index: z.number().int().min(0).max(20),
});

export async function botLedgerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/bot/ledger", async (req, reply) => {
    if (rejectBot(req, reply)) return;
    const body = messageSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "validation_error" });
    return handleLedgerMessage(body.data);
  });

  app.post("/bot/ledger/confirm", async (req, reply) => {
    if (rejectBot(req, reply)) return;
    const body = confirmSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "validation_error" });
    return confirmLedgerChoice(body.data);
  });
}
