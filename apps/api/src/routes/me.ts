import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireWriteAccess } from "../auth/plugin.js";
import { deriveLocale } from "../auth/telegram.js";
import { prisma } from "../prisma.js";
import { parse } from "./helpers.js";
import type { Currency, Locale, MeResponse } from "@taxi/shared";
import { Currency as CurrencyEnum, Locale as LocaleEnum } from "@taxi/shared";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/me", async (req): Promise<MeResponse> => {
    if (req.unregistered && req.telegramUser) {
      return {
        id: req.telegramUser.id.toString(),
        telegramUserId: req.telegramUser.id.toString(),
        name: req.telegramUser.name,
        username: req.telegramUser.username,
        status: "PENDING",
        role: "none",
        needsOnboarding: true,
        isViewer: false,
        fleetOwnerName: null,
        locale: deriveLocale(req.telegramUser.languageCode) as Locale,
        currency: CurrencyEnum.UAH,
        isSuperAdmin: false,
        subscriptionExpiresAt: null,
      };
    }

    const fleet = req.owner!;
    const isViewer = Boolean(req.isViewer && req.fleetMember);
    const membership = req.fleetMember;

    if (isViewer && membership) {
      return {
        id: membership.id,
        telegramUserId: membership.telegramUserId.toString(),
        name: membership.name,
        username: membership.username,
        status: membership.status,
        role: "viewer",
        needsOnboarding: false,
        isViewer: true,
        fleetOwnerName: fleet.name,
        locale: membership.locale as Locale,
        currency: fleet.currency as Currency,
        isSuperAdmin: false,
        subscriptionExpiresAt: fleet.subscriptionExpiresAt?.toISOString() ?? null,
      };
    }

    return {
      id: fleet.id,
      telegramUserId: fleet.telegramUserId.toString(),
      name: fleet.name,
      username: fleet.username,
      status: fleet.status,
      role: "owner",
      needsOnboarding: false,
      isViewer: false,
      fleetOwnerName: null,
      locale: fleet.locale as Locale,
      currency: fleet.currency as Currency,
      isSuperAdmin: Boolean(req.isSuperAdmin),
      subscriptionExpiresAt: fleet.subscriptionExpiresAt?.toISOString() ?? null,
    };
  });

  app.patch("/me/locale", async (req, reply) => {
    const body = parse(z.object({ locale: z.nativeEnum(LocaleEnum) }), req.body, reply);
    if (!body) return;

    if (req.isViewer && req.fleetMember) {
      const updated = await prisma.fleetMember.update({
        where: { id: req.fleetMember.id },
        data: { locale: body.locale },
      });
      return { locale: updated.locale };
    }

    if (req.unregistered) {
      return { locale: body.locale };
    }

    if (await requireWriteAccess(req, reply)) return;
    const owner = await prisma.owner.update({
      where: { id: req.owner!.id },
      data: { locale: body.locale },
    });
    return { locale: owner.locale };
  });

  app.patch("/me/currency", async (req, reply) => {
    if (await requireWriteAccess(req, reply)) return;
    const body = parse(z.object({ currency: z.nativeEnum(CurrencyEnum) }), req.body, reply);
    if (!body) return;
    const owner = await prisma.owner.update({
      where: { id: req.owner!.id },
      data: { currency: body.currency },
    });
    return { currency: owner.currency };
  });
}
