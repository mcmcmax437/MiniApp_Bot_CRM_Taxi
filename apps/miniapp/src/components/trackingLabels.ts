import type { TFunction } from "i18next";
import type { MaintenanceRecord, MaintenanceRule } from "../types";

export function maintenanceRuleLabel(
  rule: Pick<MaintenanceRule, "name" | "presetKey">,
  t: TFunction,
): string {
  if (rule.presetKey) return t(`tracking.${rule.presetKey}`);
  return rule.name;
}

export function maintenanceRecordLabel(
  record: Pick<MaintenanceRecord, "title" | "presetKey" | "ruleId">,
  t: TFunction,
  rules?: MaintenanceRule[],
): string {
  if (record.presetKey) return t(`tracking.${record.presetKey}`);
  if (record.ruleId && rules) {
    const rule = rules.find((r) => r.id === record.ruleId);
    if (rule?.presetKey) return t(`tracking.${rule.presetKey}`);
  }
  return record.title;
}

export function hasMaintenancePreset(
  existing: MaintenanceRule[],
  nameKey: string,
  t: TFunction,
): boolean {
  const translated = t(`tracking.${nameKey}`);
  return existing.some(
    (r) => r.presetKey === nameKey || r.name === translated || r.name === nameKey,
  );
}
