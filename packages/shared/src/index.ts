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
  CARD: "CARD",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentType = {
  RENT: "RENT",
  DEPOSIT: "DEPOSIT",
  REFUND: "REFUND",
  FINE: "FINE",
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

export const Locale = {
  uk: "uk",
  ru: "ru",
  en: "en",
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

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
  make: z.string().trim().max(64).optional().nullable(),
  model: z.string().trim().max(64).optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  status: z.nativeEnum(CarStatus).default(CarStatus.AVAILABLE),
  insuranceExpiry: optionalIsoDate,
  inspectionExpiry: optionalIsoDate,
  notes: z.string().trim().max(2000).optional().nullable(),
});
export const carUpdateSchema = carCreateSchema.partial();
export type CarCreateInput = z.infer<typeof carCreateSchema>;
export type CarUpdateInput = z.infer<typeof carUpdateSchema>;

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
  driverId: z.string().cuid(),
  carId: z.string().cuid().optional().nullable(),
  amount: money,
  date: isoDate,
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  type: z.nativeEnum(PaymentType).default(PaymentType.RENT),
  note: z.string().trim().max(2000).optional().nullable(),
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
  note: z.string().trim().max(2000).optional().nullable(),
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
// Admin schemas
// ---------------------------------------------------------------------------

export const ownerUpdateSchema = z.object({
  name: z.string().trim().max(128).optional().nullable(),
  locale: z.nativeEnum(Locale).optional(),
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
  locale: Locale;
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
}

export interface ReportSummary {
  from: string;
  to: string;
  income: number;
  expenses: number;
  profit: number;
  byCar: Array<{ carId: string; label: string; income: number; expenses: number; profit: number }>;
  byDriver: Array<{ driverId: string; label: string; income: number }>;
}

export interface ReminderItem {
  kind: "INSURANCE" | "INSPECTION" | "OVERDUE_PAYMENT";
  refId: string;
  label: string;
  dueDate: string | null;
  amount?: number;
}
