import type { FastifyInstance } from "fastify";
import { authenticate, requireActive, requireWriteAccess } from "../auth/plugin.js";
import { meRoutes } from "./me.js";
import { fleetAccessRoutes } from "./fleet-access.js";
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
import { maintenanceRoutes } from "./maintenance.js";
import { mileageRoutes } from "./mileage.js";
import { carDocumentsRoutes } from "./car-documents.js";
import { reminderSettingsRoutes } from "./reminder-settings.js";
import { fleetMembersRoutes } from "./fleet-members.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(meRoutes);
      await api.register(fleetAccessRoutes);
      await api.register(adminRoutes);

      // Tenant data routes: require an authenticated, ACTIVE owner.
      await api.register(async (scoped) => {
        scoped.addHook("preHandler", authenticate);
        scoped.addHook("preHandler", requireActive);
        scoped.addHook("preHandler", async (req, reply) => {
          if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
            if (await requireWriteAccess(req, reply)) return;
          }
        });
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
        await scoped.register(maintenanceRoutes);
        await scoped.register(mileageRoutes);
        await scoped.register(carDocumentsRoutes);
        await scoped.register(reminderSettingsRoutes);
        await scoped.register(fleetMembersRoutes);
      });
    },
    { prefix: "/api" },
  );
}
