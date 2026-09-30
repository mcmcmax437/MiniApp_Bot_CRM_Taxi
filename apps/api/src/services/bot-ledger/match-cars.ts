export type LedgerCar = {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
};

const TOKEN_ALIASES: Record<string, string> = {
  сузукі: "suzuki",
  сузуки: "suzuki",
  suzuki: "suzuki",
  тойота: "toyota",
  toyota: "toyota",
  тойоту: "toyota",
  ауріс: "auris",
  аурис: "auris",
  auris: "auris",
  корола: "corolla",
  corolla: "corolla",
  королу: "corolla",
  пріус: "prius",
  приус: "prius",
  prius: "prius",
};

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0400-\u04ff]/gi, "");
}

function tokensOf(query: string): string[] {
  return query
    .split(/[\s,.;:/|+]+/)
    .map((part) => fold(part))
    .filter((part) => part.length >= 3);
}

function carHaystack(car: LedgerCar): string {
  return [car.plate, car.make, car.model]
    .filter(Boolean)
    .map((part) => fold(part!))
    .join(" ");
}

function tokenMatches(car: LedgerCar, token: string): boolean {
  const alias = TOKEN_ALIASES[token] ?? token;
  const hay = carHaystack(car);
  if (hay.includes(alias)) return true;
  const plate = fold(car.plate);
  return plate.includes(alias);
}

/**
 * Narrow the fleet by each hint in the query (plate fragment or make/model).
 * Words that match nothing are ignored, so a description next to the car name
 * does not wipe the result.
 */
export function matchCars(query: string, cars: LedgerCar[]): LedgerCar[] {
  const tokens = tokensOf(query);
  if (tokens.length === 0) return [];
  let pool = cars;
  let used = 0;
  for (const token of tokens) {
    const hits = pool.filter((car) => tokenMatches(car, token));
    if (hits.length > 0) {
      pool = hits;
      used += 1;
    }
  }
  return used === 0 ? [] : pool;
}

export function carButtonLabel(car: LedgerCar): string {
  const vehicle = [car.make, car.model].filter(Boolean).join(" ");
  const label = vehicle ? `${car.plate} · ${vehicle}` : car.plate;
  return label.length > 60 ? `${label.slice(0, 57)}…` : label;
}
