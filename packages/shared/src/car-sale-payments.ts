export type SalePaymentCandidate = {
  id: string;
  type: string;
  amount: number;
  note?: string | null;
  driverId?: string | null;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Notes written when a car is sold, in the app languages, plus the saved sale note. */
export function saleNoteBases(plate: string, saleNote: string | null | undefined): string[] {
  const bases = new Set<string>();
  const note = saleNote?.trim();
  if (note) bases.add(note);
  const trimmedPlate = plate.trim();
  if (trimmedPlate) {
    bases.add(`Sale ${trimmedPlate}`);
    bases.add(`Продаж авто ${trimmedPlate}`);
    bases.add(`Продажа авто ${trimmedPlate}`);
  }
  return [...bases];
}

export function noteMatchesSale(note: string | null | undefined, bases: readonly string[]): boolean {
  const value = note?.trim() ?? "";
  if (!value) return false;
  return bases.some((base) => value === base || value.startsWith(`${base} (`));
}

/**
 * Sale payments edited on the finance page were saved as rent, so the car
 * still has a price and the lines that make it up are hidden.
 * Returns those rent rows when they clearly belong to the sale.
 * Real sale rows are left untouched.
 */
export function pickMisfiledSalePayments<T extends SalePaymentCandidate>(
  payments: readonly T[],
  args: { plate: string; saleNote?: string | null; salePrice?: number | null },
): T[] {
  if (payments.some((payment) => payment.type === "SALE")) return [];
  const rents = payments.filter((payment) => payment.type === "RENT" && !payment.driverId);
  if (rents.length === 0) return [];

  const bases = saleNoteBases(args.plate, args.saleNote);
  const noted = rents.filter((payment) => noteMatchesSale(payment.note, bases));
  if (noted.length > 0) return noted;

  if (args.salePrice == null) return [];
  const price = round2(args.salePrice);
  const exact = rents.filter((payment) => round2(payment.amount) === price);
  if (exact.length === 1) return exact;
  return [];
}
