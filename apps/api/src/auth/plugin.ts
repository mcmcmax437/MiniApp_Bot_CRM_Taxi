import type { FastifyReply, FastifyRequest } from "fastify";
import type { FleetMember, Owner } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env, isSuperAdmin, devBypassEnabled } from "../env.js";
import { deriveLocale, fullNameOf, validateInitData } from "./telegram.js";

declare module "fastify" {
  interface FastifyRequest {
    owner?: Owner;
    fleetMember?: FleetMember;
    isSuperAdmin?: boolean;
    isViewer?: boolean;
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

async function attachViewerMembership(
  req: FastifyRequest,
  membership: FleetMember & { fleet: Owner },
  tgName: string | null,
  tgUsername: string | null | undefined,
): Promise<void> {
  await prisma.fleetMember.update({
    where: { id: membership.id },
    data: {
      username: tgUsername ?? membership.username,
      ...(tgName ? { name: tgName } : {}),
    },
  });
  req.owner = membership.fleet;
  req.fleetMember = membership;
  req.isViewer = true;
  req.isSuperAdmin = false;
}

/**
 * Authenticate the request from Telegram initData.
 * Business owners are upserted as Owner (PENDING until super-admin activates).
 * Invited investors are resolved via FleetMember and get read-only fleet access.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const initData = extractInitData(req);

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
  const superAdmin = isSuperAdmin(tgUser.id);

  const owner = await prisma.owner.findUnique({ where: { telegramUserId: tgUser.id } });
  const membership = await prisma.fleetMember.findFirst({
    where: { telegramUserId: tgUser.id },
    include: { fleet: true },
    orderBy: { updatedAt: "desc" },
  });

  if (superAdmin) {
    const activeOwner =
      owner ??
      (await prisma.owner.create({
        data: {
          telegramUserId: tgUser.id,
          name,
          username: tgUser.username ?? null,
          locale: deriveLocale(tgUser.language_code),
          status: "ACTIVE",
        },
      }));
    const updated = await prisma.owner.update({
      where: { id: activeOwner.id },
      data: {
        username: tgUser.username ?? activeOwner.username,
        ...(name ? { name } : {}),
        status: "ACTIVE",
      },
    });
    req.owner = updated;
    req.isSuperAdmin = true;
    return;
  }

  if (owner?.status === "ACTIVE") {
    const updated = await prisma.owner.update({
      where: { id: owner.id },
      data: {
        username: tgUser.username ?? owner.username,
        ...(name ? { name } : {}),
      },
    });
    req.owner = updated;
    req.isSuperAdmin = false;
    return;
  }

  if (membership) {
    await attachViewerMembership(req, membership, name, tgUser.username);
    return;
  }

  if (owner) {
    const updated = await prisma.owner.update({
      where: { id: owner.id },
      data: {
        username: tgUser.username ?? owner.username,
        ...(name ? { name } : {}),
      },
    });
    req.owner = updated;
    req.isSuperAdmin = false;
    return;
  }

  const created = await prisma.owner.create({
    data: {
      telegramUserId: tgUser.id,
      name,
      username: tgUser.username ?? null,
      locale: deriveLocale(tgUser.language_code),
      status: superAdmin ? "ACTIVE" : "PENDING",
    },
  });
  req.owner = created;
  req.isSuperAdmin = isSuperAdmin(created.telegramUserId);
}

/** Require an authenticated, ACTIVE account (owner or approved viewer). */
export async function requireActive(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.isSuperAdmin) return;

  if (req.isViewer && req.fleetMember) {
    if (req.fleetMember.status !== "ACTIVE") {
      return reply.code(403).send({ error: "not_active", status: req.fleetMember.status });
    }
    if (req.owner?.status !== "ACTIVE") {
      return reply.code(403).send({ error: "fleet_inactive" });
    }
    if (req.owner?.subscriptionExpiresAt && req.owner.subscriptionExpiresAt.getTime() < Date.now()) {
      return reply.code(403).send({ error: "subscription_expired" });
    }
    return;
  }

  const owner = req.owner;
  if (!owner) {
    return reply.code(401).send({ error: "unauthenticated" });
  }
  if (owner.status !== "ACTIVE") {
    return reply.code(403).send({ error: "not_active", status: owner.status });
  }
  if (owner.subscriptionExpiresAt && owner.subscriptionExpiresAt.getTime() < Date.now()) {
    return reply.code(403).send({ error: "subscription_expired" });
  }
}

/** Block write operations for read-only investor accounts. Returns true if blocked. */
export async function requireWriteAccess(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (req.isViewer) {
    reply.code(403).send({ error: "read_only" });
    return true;
  }
  return false;
}

/** Require the configured super-admin. */
export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.isSuperAdmin) {
    return reply.code(403).send({ error: "forbidden", message: "Super-admin only" });
  }
}
