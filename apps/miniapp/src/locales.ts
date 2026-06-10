export const LOCALE_OPTIONS = [
  { value: "uk" as const, label: "Українська" },
  { value: "en" as const, label: "English" },
] as const;

export type AppLocale = (typeof LOCALE_OPTIONS)[number]["value"];

export function normalizeLocale(locale: string | undefined | null): AppLocale {
  return locale === "en" ? "en" : "uk";
}
