import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (kept in sync with prisma/schema.prisma)
// ---------------------------------------------------------------------------

export const OwnerStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type OwnerStatus = (typeof OwnerStatus)[keyof typeof OwnerStatus];

export const CarStatus = {
  AVAILABLE: "AVAILABLE",
  RENTED: "RENTED",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
} as const;
export type CarStatus = (typeof CarStatus)[keyof typeof CarStatus];

export const DriverStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type DriverStatus = (typeof DriverStatus)[keyof typeof DriverStatus];

export const RentPeriod = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type RentPeriod = (typeof RentPeriod)[keyof typeof RentPeriod];

export const AgreementStatus = {
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
} as const;
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];

export const PaymentMethod = {
  CASH: "CASH",
  BANK: "BANK",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Payment methods offered in the UI (cash and bank transfer). */
export const PAYMENT_METHODS = [PaymentMethod.CASH, PaymentMethod.BANK] as const;

export const PaymentType = {
  RENT: "RENT",
  DEPOSIT: "DEPOSIT",
  REFUND: "REFUND",
  FINE: "FINE",
  DISCOUNT: "DISCOUNT",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const ExpenseCategory = {
  MAINTENANCE: "MAINTENANCE",
  REPAIR: "REPAIR",
  INSURANCE: "INSURANCE",
  FUEL: "FUEL",
  TAX: "TAX",
  OTHER: "OTHER",
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const FineStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
} as const;
export type FineStatus = (typeof FineStatus)[keyof typeof FineStatus];

export const DocumentRelatedType = {
  CAR: "CAR",
  DRIVER: "DRIVER",
  AGREEMENT: "AGREEMENT",
} as const;
export type DocumentRelatedType = (typeof DocumentRelatedType)[keyof typeof DocumentRelatedType];

export const MaintenanceIntervalKind = {
  DAYS: "DAYS",
  MONTHS: "MONTHS",
  MILEAGE: "MILEAGE",
  YEARLY: "YEARLY",
} as const;
export type MaintenanceIntervalKind =
  (typeof MaintenanceIntervalKind)[keyof typeof MaintenanceIntervalKind];

export const MileageSource = {
  MANUAL: "MANUAL",
  WEEKLY: "WEEKLY",
  MAINTENANCE: "MAINTENANCE",
} as const;
export type MileageSource = (typeof MileageSource)[keyof typeof MileageSource];

export const TireSeason = {
  SUMMER: "SUMMER",
  WINTER: "WINTER",
  ALL_SEASON: "ALL_SEASON",
} as const;
export type TireSeason = (typeof TireSeason)[keyof typeof TireSeason];

export const Locale = {
  uk: "uk",
  ru: "ru",
  en: "en",
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const Currency = {
  UAH: "UAH",
  USD: "USD",
  EUR: "EUR",
  PLN: "PLN",
  GBP: "GBP",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

// ---------------------------------------------------------------------------
// Reusable zod helpers
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const optionalIsoDate = isoDate.optional().nullable();

const money = z.number().finite().min(0);

// ---------------------------------------------------------------------------
// Car schemas
// ---------------------------------------------------------------------------

export const carCreateSchema = z.object({
  plate: z.string().trim().min(1).max(32),
  vin: z
    .string()
    .trim()
    .max(17)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  make: z.string().trim().max(64).optional().nullable(),
  model: z.string().trim().max(64).optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  status: z.nativeEnum(CarStatus).default(CarStatus.AVAILABLE),
  insuranceExpiry: optionalIsoDate,
  inspectionExpiry: optionalIsoDate,
  notes: z.string().trim().max(2000).optional().nullable(),
  coverDocumentId: z.string().cuid().optional().nullable(),
  currentMileage: z.number().int().min(0).optional().nullable(),
  purchasePrice: money.optional().nullable(),
  purchaseDate: optionalIsoDate,
  tireBrand: z.string().trim().max(64).optional().nullable(),
  tireSize: z.string().trim().max(32).optional().nullable(),
  tireSeason: z.nativeEnum(TireSeason).optional().nullable(),
  tireInstalledAt: optionalIsoDate,
  tireNotes: z.string().trim().max(2000).optional().nullable(),
  tireFrontBrand: z.string().trim().max(64).optional().nullable(),
  tireFrontSize: z.string().trim().max(32).optional().nullable(),
  tireFrontSeason: z.nativeEnum(TireSeason).optional().nullable(),
  tireFrontInstalledAt: optionalIsoDate,
  tireFrontNotes: z.string().trim().max(2000).optional().nullable(),
  tireRearBrand: z.string().trim().max(64).optional().nullable(),
  tireRearSize: z.string().trim().max(32).optional().nullable(),
  tireRearSeason: z.nativeEnum(TireSeason).optional().nullable(),
  tireRearInstalledAt: optionalIsoDate,
  tireRearNotes: z.string().trim().max(2000).optional().nullable(),
  trackerLogin: z.string().trim().max(128).optional().nullable(),
  trackerPassword: z.string().trim().max(128).optional().nullable(),
  trackerUrl: z.string().trim().max(512).optional().nullable(),
  trackerSimNumber: z.string().trim().max(32).optional().nullable(),
  trackerNotes: z.string().trim().max(2000).optional().nullable(),
});
export const carUpdateSchema = carCreateSchema.partial();
export type CarCreateInput = z.infer<typeof carCreateSchema>;
export type CarUpdateInput = z.infer<typeof carUpdateSchema>;

/** Required fields for the car add/edit form (client-side validation). */
export const carFormSchema = z.object({
  plate: z.string().trim().min(1).max(32),
  make: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(64),
  year: z.number().int().min(1950).max(2100),
  status: z.nativeEnum(CarStatus),
  insuranceExpiry: z.string().optional(),
  inspectionExpiry: z.string().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type CarFormField = keyof z.infer<typeof carFormSchema>;

export function carFormFieldErrors(input: {
  plate: string;
  make: string;
  model: string;
  year: number | "";
  status: CarStatus;
  insuranceExpiry: string;
  inspectionExpiry: string;
  notes: string;
}): Set<CarFormField> {
  const result = carFormSchema.safeParse({
    plate: input.plate,
    make: input.make,
    model: input.model,
    year: input.year === "" ? undefined : input.year,
    status: input.status,
    insuranceExpiry: input.insuranceExpiry,
    inspectionExpiry: input.inspectionExpiry,
    notes: input.notes || null,
  });
  if (result.success) return new Set();
  const fields = new Set<CarFormField>();
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") fields.add(key as CarFormField);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Driver schemas
// ---------------------------------------------------------------------------

export function driverFullName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): string {
  const fromParts = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return fromParts || input.fullName?.trim() || "";
}

export const driverCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(64),
  phone: z.string().trim().max(32).optional().nullable(),
  telegramUsername: z.string().trim().max(64).optional().nullable(),
  pesel: z.string().trim().max(11).optional().nullable(),
  passportNumber: z.string().trim().max(32).optional().nullable(),
  addressCity: z.string().trim().max(128).optional().nullable(),
  addressPostalCode: z.string().trim().max(16).optional().nullable(),
  addressStreet: z.string().trim().max(128).optional().nullable(),
  addressHouse: z.string().trim().max(32).optional().nullable(),
  addressFlat: z.string().trim().max(32).optional().nullable(),
  fatherName: z.string().trim().max(128).optional().nullable(),
  motherName: z.string().trim().max(128).optional().nullable(),
  status: z.nativeEnum(DriverStatus).default(DriverStatus.ACTIVE),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const driverUpdateSchema = driverCreateSchema.partial();
export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;

/** Required / validated fields for the driver add/edit form (client-side). */
export const driverFormSchema = z
  .object({
    firstName: z.string().trim().min(1).max(64),
    lastName: z.string().trim().min(1).max(64),
    phone: z.string().trim().max(32).optional().nullable(),
    telegramUsername: z.string().trim().max(64).optional().nullable(),
    pesel: z.string().trim().max(11).optional().nullable(),
    passportNumber: z.string().trim().max(32).optional().nullable(),
    addressCity: z.string().trim().min(1).max(128),
    addressPostalCode: z.string().trim().min(1).max(16),
    addressStreet: z.string().trim().min(1).max(128),
    addressHouse: z.string().trim().min(1).max(32),
    addressFlat: z.string().trim().max(32).optional().nullable(),
    fatherName: z.string().trim().max(128).optional().nullable(),
    motherName: z.string().trim().max(128).optional().nullable(),
    status: z.nativeEnum(DriverStatus),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const pesel = data.pesel?.trim() ?? "";
    const passport = data.passportNumber?.trim() ?? "";
    if (!pesel && !passport) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pesel"] });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["passportNumber"] });
    }
    if (pesel && !/^\d{11}$/.test(pesel)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pesel"] });
    }
  });

export type DriverFormField = keyof z.infer<typeof driverFormSchema>;

export function driverFormFieldErrors(input: {
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  pesel: string;
  passportNumber: string;
  addressCity: string;
  addressPostalCode: string;
  addressStreet: string;
  addressHouse: string;
  addressFlat: string;
  fatherName: string;
  motherName: string;
  status: DriverStatus;
  notes: string;
}): Set<DriverFormField> {
  const result = driverFormSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone || null,
    telegramUsername: input.telegramUsername || null,
    pesel: input.pesel || null,
    passportNumber: input.passportNumber || null,
    addressCity: input.addressCity,
    addressPostalCode: input.addressPostalCode,
    addressStreet: input.addressStreet,
    addressHouse: input.addressHouse,
    addressFlat: input.addressFlat || null,
    fatherName: input.fatherName || null,
    motherName: input.motherName || null,
    status: input.status,
    notes: input.notes || null,
  });
  if (result.success) return new Set();
  const fields = new Set<DriverFormField>();
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") fields.add(key as DriverFormField);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Rental agreement schemas
// ---------------------------------------------------------------------------

export const agreementCreateSchema = z.object({
  carId: z.string().cuid(),
  driverId: z.string().cuid(),
  rentAmount: money,
  depositAmount: money.default(0),
  period: z.nativeEnum(RentPeriod).default(RentPeriod.DAILY),
  startDate: isoDate,
  endDate: optionalIsoDate,
  status: z.nativeEnum(AgreementStatus).default(AgreementStatus.ACTIVE),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const agreementUpdateSchema = agreementCreateSchema.partial();
export type AgreementCreateInput = z.infer<typeof agreementCreateSchema>;
export type AgreementUpdateInput = z.infer<typeof agreementUpdateSchema>;

// ---------------------------------------------------------------------------
// Payment schemas
// ---------------------------------------------------------------------------

export const paymentCreateSchema = z.object({
  driverId: z.string().cuid().optional().nullable(),
  carId: z.string().cuid().optional().nullable(),
  amount: money,
  // Optional one-off discount applied to this payment. Recorded on the
  // same Payment row so the owner only creates one entry per cash event
  // (e.g. rent was 700, the car was inactive for two days, the driver
  // paid 400, and the discount is 300). Default 0 means "no discount";
  // legacy DISCOUNT-type payments are still honoured by the balance
  // calculation for backwards compatibility.
  discountAmount: money.optional().default(0),
  date: isoDate,
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK),
  type: z.nativeEnum(PaymentType).default(PaymentType.RENT),
  note: z.string().trim().max(12000).optional().nullable(),
  receivedByPartner: z.boolean().default(false),
  partnerSettled: z.boolean().default(false),
});
export const paymentUpdateSchema = paymentCreateSchema.partial();
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;

// ---------------------------------------------------------------------------
// Expense schemas
// ---------------------------------------------------------------------------

export const expenseCreateSchema = z.object({
  carId: z.string().cuid().optional().nullable(),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  amount: money,
  date: isoDate,
  note: z.string().trim().max(12000).optional().nullable(),
  tag: z.string().trim().max(64).optional().nullable(),
  paidByPartner: z.boolean().default(false),
  partnerSettled: z.boolean().default(false),
  paidByFather: z.boolean().default(false),
});
export const expenseUpdateSchema = expenseCreateSchema.partial();
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

// ---------------------------------------------------------------------------
// Fine schemas
// ---------------------------------------------------------------------------

export const fineCreateSchema = z.object({
  carId: z.string().cuid().optional().nullable(),
  driverId: z.string().cuid().optional().nullable(),
  amount: money,
  date: isoDate,
  status: z.nativeEnum(FineStatus).default(FineStatus.UNPAID),
  description: z.string().trim().max(2000).optional().nullable(),
});
export const fineUpdateSchema = fineCreateSchema.partial();
export type FineCreateInput = z.infer<typeof fineCreateSchema>;
export type FineUpdateInput = z.infer<typeof fineUpdateSchema>;

// ---------------------------------------------------------------------------
// Shift schemas
// ---------------------------------------------------------------------------

export const shiftCreateSchema = z.object({
  carId: z.string().cuid(),
  driverId: z.string().cuid(),
  date: isoDate,
  mileageStart: z.number().int().min(0).optional().nullable(),
  mileageEnd: z.number().int().min(0).optional().nullable(),
  income: money.optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});
export const shiftUpdateSchema = shiftCreateSchema.partial();
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;

// ---------------------------------------------------------------------------
// Car tracking schemas
// ---------------------------------------------------------------------------

export const maintenanceRuleCreateSchema = z.object({
  carId: z.string().cuid(),
  name: z.string().trim().min(1).max(128),
  presetKey: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  intervalKind: z.nativeEnum(MaintenanceIntervalKind),
  intervalValue: z.number().int().min(1),
  yearlyMonth: z.number().int().min(1).max(12).optional().nullable(),
  isMandatory: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export const maintenanceRuleUpdateSchema = maintenanceRuleCreateSchema
  .omit({ carId: true })
  .partial();
export type MaintenanceRuleCreateInput = z.infer<typeof maintenanceRuleCreateSchema>;

export const maintenanceRecordCreateSchema = z.object({
  carId: z.string().cuid(),
  ruleId: z.string().cuid().optional().nullable(),
  title: z.string().trim().min(1).max(128),
  presetKey: z.string().trim().max(64).optional().nullable(),
  completedAt: isoDate,
  mileageAt: z.number().int().min(0).optional().nullable(),
  cost: money.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const carDocumentCreateSchema = z.object({
  carId: z.string().cuid(),
  title: z.string().trim().min(1).max(128),
  expiryDate: optionalIsoDate,
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const carDocumentUpdateSchema = carDocumentCreateSchema.omit({ carId: true }).partial();

export const documentUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const mileageLogCreateSchema = z.object({
  carId: z.string().cuid(),
  driverId: z.string().cuid().optional().nullable(),
  odometer: z.number().int().min(0),
  recordedAt: isoDate.optional(),
  source: z.nativeEnum(MileageSource).default(MileageSource.MANUAL),
  note: z.string().trim().max(500).optional().nullable(),
});

export const reminderSettingsUpdateSchema = z.object({
  insuranceDaysBefore: z.string().trim().max(64).optional(),
  inspectionDaysBefore: z.string().trim().max(64).optional(),
  documentDaysBefore: z.string().trim().max(64).optional(),
  inspectionMileageIntervalKm: z.number().int().min(1000).max(500_000).optional().nullable(),
  weeklyMileageEnabled: z.boolean().optional(),
  weeklyMileageWeekday: z.number().int().min(0).max(6).optional(),
});

// ---------------------------------------------------------------------------
// Admin schemas
// ---------------------------------------------------------------------------

export const ownerUpdateSchema = z.object({
  name: z.string().trim().max(128).optional().nullable(),
  locale: z.nativeEnum(Locale).optional(),
  currency: z.nativeEnum(Currency).optional(),
  status: z.nativeEnum(OwnerStatus).optional(),
  subscriptionExpiresAt: optionalIsoDate,
});
export type OwnerUpdateInput = z.infer<typeof ownerUpdateSchema>;

// ---------------------------------------------------------------------------
// API response types (shared with the Mini App)
// ---------------------------------------------------------------------------

export interface MeResponse {
  id: string;
  telegramUserId: string;
  name: string | null;
  username: string | null;
  status: OwnerStatus;
  role: "owner" | "viewer" | "none";
  needsOnboarding: boolean;
  isViewer: boolean;
  fleetOwnerName: string | null;
  locale: Locale;
  currency: Currency;
  isSuperAdmin: boolean;
  subscriptionExpiresAt: string | null;
}

export interface DriverBalance {
  driverId: string;
  driverName: string;
  rentDue: number;
  rentPaid: number;
  unpaidFines: number;
  balance: number; // positive => the driver owes you
  depositHeld: number;
  /**
   * The cars the driver is currently assigned to under an ACTIVE rental
   * agreement. Empty if the driver isn't currently driving. Car id and
   * plate are exposed so the UI (drivers list, finance tab, reminders)
   * can label each balance with "Driver — Plate" instead of just the
   * driver's name.
   */
  activeCars: { id: string; plate: string }[];
}

/**
 * A single active agreement that is accruing rent toward the driver's
 * outstanding balance. Returned by the breakdown endpoint and rendered
 * in the Driver Balance Breakdown modal.
 */
export interface DriverBalanceAccrual {
  agreementId: string;
  carPlate: string;
  carLabel: string;
  period: RentPeriod;
  rentAmount: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string | null;
  daysElapsed: number;
  periods: number;
  accrued: number;
}

/**
 * One record on the driver's ledger — a single RENT/DEPOSIT/REFUND/FINE
 * payment (or a discount, which can be its own row or ride inline on a
 * RENT payment via `discountAmount`).
 */
export interface DriverBalancePaymentLine {
  id: string;
  date: string; // ISO date or full ISO timestamp
  type: string;
  amount: number;
  note: string | null;
  carPlate: string | null;
  method: string | null;
}

/**
 * One unpaid fine linked to the driver.
 */
export interface DriverBalanceFineLine {
  id: string;
  date: string;
  amount: number;
  description: string | null;
}

/**
 * Detailed breakdown of how a driver's balance was computed. Returned by
 * the server via GET /drivers/:id/balance/breakdown so the modal can render
 * the same figures that appear on the drivers list (which uses /balances).
 *
 * The two paths must agree — if a RENT payment or new agreement has been
 * recorded recently but the modal's cached agreements/payments aren't yet
 * refreshed, a client-side recompute would diverge from the live balance.
 * Computing the breakdown on the server keeps a single source of truth.
 */
export interface DriverBalanceBreakdown {
  driverId: string;
  driverName: string;
  /** ISO timestamp the breakdown was computed at (server clock). */
  asOf: string;
  /** Active agreements currently accruing rent. */
  activeAccruals: DriverBalanceAccrual[];
  rentDue: number;
  rentPayments: DriverBalancePaymentLine[];
  discountPayments: DriverBalancePaymentLine[];
  depositPayments: DriverBalancePaymentLine[];
  refundPayments: DriverBalancePaymentLine[];
  rentPaid: number;
  discounts: number;
  unpaidFines: DriverBalanceFineLine[];
  unpaidFinesTotal: number;
  depositHeld: number;
  balance: number; // = rentDue - rentPaid - discounts + unpaidFines
}

/** Per-driver income in one calendar month, split by payment method. */
export interface DriverIncomeMonthDriverRow {
  driverId: string;
  driverName: string;
  pesel: string | null;
  passportNumber: string | null;
  /** PESEL when set, otherwise passport number — for accountant exports. */
  idDocument: string;
  address: string;
  cash: number;
  bank: number;
  total: number;
}

export interface DriverIncomeMonthTotals {
  cash: number;
  bank: number;
  total: number;
}

/** One calendar month of driver income (cash vs bank). */
export interface DriverIncomeMonthSection {
  /** YYYY-MM */
  month: string;
  drivers: DriverIncomeMonthDriverRow[];
  totals: DriverIncomeMonthTotals;
}

/**
 * Driver income report for accountants: rent + fine payments grouped by
 * calendar month and driver, with cash and bank columns.
 */
export interface DriverIncomeReport {
  from: string;
  to: string;
  months: DriverIncomeMonthSection[];
  grandTotals: DriverIncomeMonthTotals;
}

/** One partner-related payment or expense line in the settlement report. */
export interface PartnerSettlementLine {
  id: string;
  date: string;
  amount: number;
  description: string;
  settled: boolean;
}

export interface PartnerSettlementMonth {
  /** YYYY-MM */
  month: string;
  /** Outstanding — partner collected but has not settled back to you. */
  partnerOwesYou: number;
  /** Outstanding — partner paid on your behalf and you have not reimbursed yet. */
  youOwePartner: number;
  /** partnerOwesYou − youOwePartner; positive = partner pays you. */
  netBalance: number;
  /** All partner-collected payments in this month (including already settled). */
  partnerCollectedTotal: number;
  /** All partner-paid expenses in this month (including already settled). */
  partnerExpensesTotal: number;
  payments: PartnerSettlementLine[];
  expenses: PartnerSettlementLine[];
}

export interface PartnerSettlementTotals {
  partnerOwesYou: number;
  youOwePartner: number;
  netBalance: number;
  partnerCollectedTotal: number;
  partnerExpensesTotal: number;
}

/**
 * Monthly partner settlement: income the partner collected vs expenses they
 * paid on your behalf, with a net balance for end-of-month reconciliation.
 */
export interface PartnerSettlementReport {
  from: string;
  to: string;
  months: PartnerSettlementMonth[];
  totals: PartnerSettlementTotals;
}

export interface ReportSummary {
  from: string;
  to: string;
  income: number;
  expenses: number;
  profit: number;
  /** Sum of car purchase prices (fleet capital). */
  totalInvestment: number;
  /** Monthly profit as % of totalInvestment, or null if no purchase prices recorded. */
  roiPercent: number | null;
  byCar: Array<{ carId: string; label: string; income: number; expenses: number; profit: number }>;
  byDriver: Array<{ driverId: string; label: string; income: number }>;
  /**
   * Snapshot of partner-unsettled amounts as of the report's "to" date.
   * These are not filtered by `from`/`to` because the owner wants to know
   * the running total that the partner still owes them regardless of period.
   */
  partnerUnsettled: {
    /** Payments the partner collected but has not yet settled back to the owner. */
    paymentsUnsettled: number;
    paymentsUnsettledCount: number;
    /** Expenses the owner has not yet reimbursed the partner for. */
    expensesUnsettled: number;
    expensesUnsettledCount: number;
  };
}

export interface ReminderItem {
  kind:
    | "INSURANCE"
    | "INSPECTION"
    | "DOCUMENT"
    | "OVERDUE_PAYMENT"
    | "MILEAGE_REPORT"
    | "RENTAL_ENDING";
  refId: string;
  carId?: string;
  /** Driver associated with the reminder, when applicable. */
  driverId?: string;
  label: string;
  dueDate: string | null;
  amount?: number;
  daysUntil?: number;
  detail?: string;
}

export interface ReminderSettings {
  insuranceDaysBefore: string;
  inspectionDaysBefore: string;
  documentDaysBefore: string;
  inspectionMileageIntervalKm: number | null;
  weeklyMileageEnabled: boolean;
  weeklyMileageWeekday: number;
  weeklyMileageSkippedWeekStart: string | null;
  /** True when the owner skipped mileage check-in for the current weekly window. */
  weeklyMileageSkippedThisWeek: boolean;
}

export {
  findRentalPeriodConflict,
  rentalPeriodsConflict,
  type RentalPeriodLike,
} from "./agreement-overlap.js";
