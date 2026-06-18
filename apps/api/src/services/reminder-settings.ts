import { prisma } from "../prisma.js";

const DEFAULTS = {
  insuranceDaysBefore: "14,7,3",
  inspectionDaysBefore: "7,3,1",
  documentDaysBefore: "14,7,3",
  weeklyMileageEnabled: true,
  weeklyMileageWeekday: 1,
};

export async function ensureReminderSettings(ownerIdValue: string) {
  return prisma.ownerReminderSettings.upsert({
    where: { ownerId: ownerIdValue },
    create: { ownerId: ownerIdValue, ...DEFAULTS },
    update: {},
  });
}
