import type {
  CarStatus,
  DriverStatus,
  RentPeriod,
  AgreementStatus,
  PaymentMethod,
  PaymentType,
  ExpenseCategory,
  FineStatus,
  DocumentRelatedType,
  OwnerStatus,
} from "@taxi/shared";

export interface Car {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  status: CarStatus;
  insuranceExpiry: string | null;
  inspectionExpiry: string | null;
  notes: string | null;
  coverDocumentId?: string | null;
  agreements?: Array<{ driver?: { id: string; fullName: string } }>;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  telegramUsername: string | null;
  pesel: string | null;
  passportNumber: string | null;
  addressCity: string | null;
  addressStreet: string | null;
  addressHouse: string | null;
  addressFlat: string | null;
  fatherName: string | null;
  motherName: string | null;
  status: DriverStatus;
  notes: string | null;
  createdAt?: string;
  agreements?: Agreement[];
}

export interface Agreement {
  id: string;
  carId: string;
  driverId: string;
  rentAmount: number;
  depositAmount: number;
  period: RentPeriod;
  startDate: string;
  endDate: string | null;
  status: AgreementStatus;
  notes: string | null;
  car?: { id: string; plate: string };
  driver?: { id: string; fullName: string };
}

export interface Payment {
  id: string;
  driverId: string;
  carId: string | null;
  amount: number;
  date: string;
  method: PaymentMethod;
  type: PaymentType;
  note: string | null;
  driver?: { id: string; fullName: string };
  car?: { id: string; plate: string } | null;
}

export interface Expense {
  id: string;
  carId: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note: string | null;
  car?: { id: string; plate: string } | null;
}

export interface Fine {
  id: string;
  carId: string | null;
  driverId: string | null;
  amount: number;
  date: string;
  status: FineStatus;
  description: string | null;
  driver?: { id: string; fullName: string } | null;
  car?: { id: string; plate: string } | null;
}

export interface Shift {
  id: string;
  carId: string;
  driverId: string;
  date: string;
  mileageStart: number | null;
  mileageEnd: number | null;
  income: number | null;
  note: string | null;
  driver?: { id: string; fullName: string };
  car?: { id: string; plate: string };
}

export interface DocumentItem {
  id: string;
  relatedType: DocumentRelatedType;
  relatedId: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  uploadedAt: string;
}

export interface OwnerRow {
  id: string;
  telegramUserId: string;
  name: string | null;
  username: string | null;
  status: OwnerStatus;
  locale: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  cars: number;
  drivers: number;
}
