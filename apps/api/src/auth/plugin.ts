import type { FastifyReply, FastifyRequest } from "fastify";
import type { Owner } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env, isSuperAdmin, devBypassEnabled } from "../env.js";
import { deriveLocale, fullNameOf, validateInitData } from "./telegram.js";

declare module "fastify" {
  interface FastifyRequest {
    owner?: Owner;
    isSuperAdmin?: boolean;
  }
}

function extractInitData(req: FastifyRequest): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string") {
    const [scheme, ...rest] = auth.split(" ");
    if (scheme.toLowerCase() === "tma" && rest.length) {
      return rest.join(" ");
    }
  }
  const header = req.headers["x-init-data"];
  if (typeof header === "string" && header.length) {
    return header;
  }
  return null;
}

/**
 * Authenticate the request from Telegram initData, upserting the Owner (tenant).
 * New owners are created with status PENDING and must be activated by the super-admin.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const initData = extractInitData(req);

  // Local-dev convenience: no Telegram available, authenticate as a fake super-admin.
  if (!initData && devBypassEnabled()) {
    const devId = BigInt(env.devUserId);
    const owner = await prisma.owner.upsert({
      where: { telegramUserId: devId },
      update: { status: "ACTIVE" },
      create: {
        telegramUserId: devId,
        name: "Local Dev",
        status: "ACTIVE",
        locale: "uk",
      },
    });
    req.owner = owner;
    req.isSuperAdmin = true;
    return;
  }

  if (!initData) {
    return reply.code(401).send({ error: "missing_init_data", message: "No Telegram initData provided" });
  }

  let validated;
  try {
    validated = validateInitData(initData, env.botToken, env.initDataMaxAgeSeconds);
  } catch (err) {
    req.log.warn({ err }, "initData validation failed");
    return reply.code(401).send({ error: "invalid_init_data", message: "Telegram authentication failed" });
  }

  const tgUser = validated.user;
  const name = fullNameOf(tgUser) || tgUser.username || null;

  const owner = await prisma.owner.upsert({
    where: { telegramUserId: tgUser.id },
    update: {
      username: tgUser.username ?? null,
      ...(name ? { name } : {}),
    },
    create: {
      telegramUserId: tgUser.id,
      name,
      username: tgUser.username ?? null,
      locale: deriveLocale(tgUser.language_code),
      // The very first user matching the configured super-admin id is auto-activated.
      status: isSuperAdmin(tgUser.id) ? "ACTIVE" : "PENDING",
    },
  });

  req.owner = owner;
  req.isSuperAdmin = isSuperAdmin(owner.telegramUserId);
}

/** Require an authenticated, ACTIVE owner with a non-expired subscription. */
export async function requireActive(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const owner = req.owner;
  if (!owner) {
    return reply.code(401).send({ error: "unauthenticated" });
  }
  if (req.isSuperAdmin) return; // super-admin always has access

  if (owner.status !== "ACTIVE") {
    return reply.code(403).send({ error: "not_active", status: owner.status });
  }
  if (owner.subscriptionExpiresAt && owner.subscriptionExpiresAt.getTime() < Date.now()) {
    return reply.code(403).send({ error: "subscription_expired" });
  }
}

/** Require the configured super-admin. */
export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.isSuperAdmin) {
    return reply.code(403).send({ error: "forbidden", message: "Super-admin only" });
  }
}
