type CopyLocale = "uk" | "ru" | "en";

export function copyLocale(locale: string | null | undefined): CopyLocale {
  if (locale === "ru" || locale === "en") return locale;
  return "uk";
}

const TEXT = {
  uk: {
    notOwner: "Швидкий запис доступний лише активованому власнику автопарку.",
    viewer: "Записи з чату може додавати лише власник автопарку.",
    expired: "Підписка автопарку закінчилась, тож запис з чату вимкнено.",
    notConfigured: "Швидкий запис ще не налаштовано.",
    noCredits: "На рахунку API немає кредитів. Поповніть баланс DeepSeek (або Grok) — безкоштовний чат на сайті це не покриває.",
    aiFailed: "Не вдалося розібрати повідомлення. Спробуйте ще раз.",
    unknown: "Не зрозумів. Наприклад: «Прошивка Сузукі 450» або «+550 5132».",
    noCar: "Не знайшов таке авто у вашому парку.",
    tooMany: "Знайшов надто багато авто. Напишіть номер з таблички.",
    choose: "Знайшов кілька авто. Яке саме?",
    stale: "Цей вибір вже не діє. Надішліть повідомлення ще раз.",
    savedExpense: "Записав витрату",
    savedIncome: "Записав дохід",
    driver: "Водій",
    noDriver: "Активного водія на цю дату не знайдено",
    tempDriver: "Тимчасовий водій",
  },
  ru: {
    notOwner: "Быстрая запись доступна только активированному владельцу автопарка.",
    viewer: "Записи из чата может добавлять только владелец автопарка.",
    expired: "Подписка автопарка закончилась, запись из чата отключена.",
    notConfigured: "Быстрая запись ещё не настроена.",
    noCredits: "На счёте API нет кредитов. Пополните баланс DeepSeek (или Grok) — бесплатный чат на сайте это не покрывает.",
    aiFailed: "Не удалось разобрать сообщение. Попробуйте ещё раз.",
    unknown: "Не понял. Например: «Прошивка Сузуки 450» или «+550 5132».",
    noCar: "Не нашёл такое авто в вашем парке.",
    tooMany: "Нашёл слишком много авто. Напишите номер с таблички.",
    choose: "Нашёл несколько авто. Какое именно?",
    stale: "Этот выбор уже не действует. Отправьте сообщение ещё раз.",
    savedExpense: "Записал расход",
    savedIncome: "Записал доход",
    driver: "Водитель",
    noDriver: "Активный водитель на эту дату не найден",
    tempDriver: "Временный водитель",
  },
  en: {
    notOwner: "Quick entry is only available to an activated fleet owner.",
    viewer: "Only the fleet owner can add entries from chat.",
    expired: "The fleet subscription has ended, so chat entry is off.",
    notConfigured: "Quick entry is not configured yet.",
    noCredits: "The API account has no credits. Add balance for DeepSeek or Grok. The free chat website does not cover this.",
    aiFailed: "Could not read that message. Try again.",
    unknown: 'I did not understand. For example: "Suzuki tune 450" or "+550 5132".',
    noCar: "I could not find that car in your fleet.",
    tooMany: "Too many cars matched. Send a plate fragment.",
    choose: "Several cars matched. Which one?",
    stale: "That choice expired. Send the message again.",
    savedExpense: "Saved expense",
    savedIncome: "Saved income",
    driver: "Driver",
    noDriver: "No active driver on that date",
    tempDriver: "Temporary driver",
  },
} as const;

export type LedgerCopy = (typeof TEXT)[CopyLocale];

export function ledgerCopy(locale: string | null | undefined): LedgerCopy {
  return TEXT[copyLocale(locale)];
}

export function formatLedgerAmount(amount: number, currency: string, locale: string): string {
  const tag = copyLocale(locale);
  try {
    return new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatLedgerDate(isoDate: string, locale: string): string {
  const tag = copyLocale(locale);
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
