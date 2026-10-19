import { prisma } from "../prisma.js";
import { fetchMkingDailyDistances, TrackerError } from "./mking-tracker.js";
import { previousWeekRange } from "./tracker-week.js";

function dayDate(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

export async function syncCarTrackerWeek(car: {
  id: string;
  ownerId: string;
  trackerLogin: string;
  trackerPassword: string;
  trackerUrl: string | null;
}, range?: { start: string; end: string }, now = new Date()): Promise<number> {
  const window = range ?? previousWeekRange(now);
  const days = await fetchMkingDailyDistances(
    {
      baseUrl: car.trackerUrl,
      login: car.trackerLogin,
      password: car.trackerPassword,
      loginType: "DEVICE",
    },
    window.start,
    window.end,
  );
  for (const row of days) {
    if (row.date < window.start || row.date >= window.end) continue;
    const day = dayDate(row.date);
    await prisma.trackerDayDistance.upsert({
      where: { carId_day: { carId: car.id, day } },
      create: {
        ownerId: car.ownerId,
        carId: car.id,
        day,
        distanceKm: row.distanceKm,
      },
      update: { distanceKm: row.distanceKm },
    });
  }
  return days.filter((row) => row.date >= window.start && row.date < window.end).length;
}

/** Pull last week's GPS kilometres for every car that has a tracker. */
export async function runWeeklyTrackerDistanceJob(
  log: (msg: string, meta?: unknown) => void = () => {},
): Promise<void> {
  const cars = await prisma.car.findMany({
    where: { trackerLogin: { not: null }, trackerPassword: { not: null } },
    select: {
      id: true,
      ownerId: true,
      plate: true,
      trackerLogin: true,
      trackerPassword: true,
      trackerUrl: true,
    },
  });
  for (const car of cars) {
    if (!car.trackerLogin || !car.trackerPassword) continue;
    try {
      const saved = await syncCarTrackerWeek({
        id: car.id,
        ownerId: car.ownerId,
        trackerLogin: car.trackerLogin,
        trackerPassword: car.trackerPassword,
        trackerUrl: car.trackerUrl,
      });
      log(`Saved ${saved} tracker days for ${car.plate}`);
    } catch (err) {
      const code = err instanceof TrackerError ? err.code : "tracker_unavailable";
      log(`Tracker week failed for ${car.plate}`, code);
    }
  }
}
