import type { FastifyInstance } from "fastify";
import { authenticate, requireActive } from "../auth/plugin.js";
import { meRoutes } from "./me.js";
import { adminRoutes } from "./admin.js";
import { carsRoutes } from "./cars.js";
import { driversRoutes } from "./drivers.js";
import { agreementsRoutes } from "./agreements.js";
import { paymentsRoutes } from "./payments.js";
import { expensesRoutes } from "./expenses.js";
import { finesRoutes } from "./fines.js";
import { shiftsRoutes } from "./shifts.js";
import { reportsRoutes } from "./reports.js";
import { documentsRoutes } from "./documents.js";
import { importRoutes } from "./import.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(meRoutes);
      await api.register(adminRoutes);

      // Tenant data routes: require an authenticated, ACTIVE owner.
      await api.register(async (scoped) => {
        scoped.addHook("preHandler", authenticate);
        scoped.addHook("preHandler", requireActive);
        await scoped.register(carsRoutes);
        await scoped.register(driversRoutes);
        await scoped.register(agreementsRoutes);
        await scoped.register(paymentsRoutes);
        await scoped.register(expensesRoutes);
        await scoped.register(finesRoutes);
        await scoped.register(shiftsRoutes);
        await scoped.register(reportsRoutes);
        await scoped.register(documentsRoutes);
        await scoped.register(importRoutes);
      });
    },
    { prefix: "/api" },
  );
}
