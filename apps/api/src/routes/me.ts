import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/plugin.js";
import { prisma } from "../prisma.js";
import { parse } from "./helpers.js";
import type { Locale, MeResponse } from "@taxi/shared";
import { Locale as LocaleEnum } from "@taxi/shared";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/me", async (req): Promise<MeResponse> => {
    const owner = req.owner!;
    return {
      id: owner.id,
      telegramUserId: owner.telegramUserId.toString(),
      name: owner.name,
      username: owner.username,
      status: owner.status,
      locale: owner.locale as Locale,
      isSuperAdmin: Boolean(req.isSuperAdmin),
      subscriptionExpiresAt: owner.subscriptionExpiresAt?.toISOString() ?? null,
    };
  });

  // Owners can change their own UI language.
  app.patch("/me/locale", async (req, reply) => {
    const body = parse(z.object({ locale: z.nativeEnum(LocaleEnum) }), req.body, reply);
    if (!body) return;
    const owner = await prisma.owner.update({
      where: { id: req.owner!.id },
      data: { locale: body.locale },
    });
    return { locale: owner.locale };
  });
}
