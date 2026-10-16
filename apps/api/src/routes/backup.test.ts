import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const { deliverOwnerBackupMock } = vi.hoisted(() => ({
  deliverOwnerBackupMock: vi.fn(),
}));

vi.mock("../services/fleet-backup.js", () => ({
  deliverOwnerBackup: deliverOwnerBackupMock,
}));

import { backupRoutes } from "./backup.js";

type TestOwner = {
  id: string;
  telegramUserId: bigint;
  locale: string;
};

async function buildApp(owner?: TestOwner) {
  const app = Fastify();
  if (owner) {
    app.addHook("preHandler", async (req) => {
      (req as unknown as { owner: TestOwner }).owner = owner;
    });
  }
  await app.register(backupRoutes);
  return app;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("backupRoutes", () => {
  it("rejects requests without an attached owner", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: "POST", url: "/backup" });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: "unauthenticated" });
      expect(deliverOwnerBackupMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("delivers a backup for the authenticated owner", async () => {
    deliverOwnerBackupMock.mockResolvedValueOnce(undefined);
    const owner = { id: "owner-1", telegramUserId: 123n, locale: "en" };
    const app = await buildApp(owner);
    try {
      const res = await app.inject({ method: "POST", url: "/backup" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(deliverOwnerBackupMock).toHaveBeenCalledWith(owner);
    } finally {
      await app.close();
    }
  });

  it("maps delivery errors to a bad-gateway response", async () => {
    deliverOwnerBackupMock.mockRejectedValueOnce(new Error("telegram down"));
    const app = await buildApp({ id: "owner-1", telegramUserId: 123n, locale: "en" });
    try {
      const res = await app.inject({ method: "POST", url: "/backup" });

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: "backup_failed" });
    } finally {
      await app.close();
    }
  });
});
