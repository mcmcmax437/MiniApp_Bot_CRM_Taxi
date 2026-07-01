export interface WeeklyMileageSkipSettings {
  weeklyMileageSkippedWeekStart?: Date | null;
  weeklyMileageWeekday: number;
}

export function startOfCurrentWeeklyMileageWindow(now: Date, weekday: number): Date {
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = (day - weekday + 7) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diff);
  return start;
}

export function isWeeklyMileageSkipped(
  settings: WeeklyMileageSkipSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.weeklyMileageSkippedWeekStart) return false;
  return (
    settings.weeklyMileageSkippedWeekStart.getTime() ===
    startOfCurrentWeeklyMileageWindow(now, settings.weeklyMileageWeekday).getTime()
  );
}
