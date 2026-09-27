import type { Currency } from "@taxi/shared";

export type FxRateResult = {
  from: Currency;
  to: Currency;
  /** How many `to` units per 1 `from` unit. */
  rate: number;
  date: string;
  source: string;
};

type CacheEntry = { at: number; rates: Record<string, number>; date: string; source: string };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const baseCache = new Map<string, CacheEntry>();

function roundRate(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

async function fetchOpenErApi(base: string): Promise<CacheEntry> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`fx_http_${res.status}`);
  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (data.result !== "success" || !data.rates) throw new Error("fx_bad_payload");
  const date = data.time_last_update_utc
    ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return { at: Date.now(), rates: data.rates, date, source: "exchangerate-api.com" };
}

async function fetchFrankfurter(base: string): Promise<CacheEntry> {
  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
    { signal: AbortSignal.timeout(8000), redirect: "follow" },
  );
  if (!res.ok) throw new Error(`fx_http_${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number>; date?: string };
  if (!data.rates) throw new Error("fx_bad_payload");
  return {
    at: Date.now(),
    rates: { ...data.rates, [base]: 1 },
    date: data.date ?? new Date().toISOString().slice(0, 10),
    source: "frankfurter.app",
  };
}

async function loadBaseRates(base: Currency): Promise<CacheEntry> {
  const cached = baseCache.get(base);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  // Prefer open.er-api (covers UAH + our other currencies). Fall back to ECB/Frankfurter.
  let entry: CacheEntry;
  try {
    entry = await fetchOpenErApi(base);
  } catch {
    entry = await fetchFrankfurter(base);
  }
  baseCache.set(base, entry);
  return entry;
}

/**
 * Live mid-market rate: how many `to` units for 1 `from` unit.
 * Cached per base currency for an hour.
 */
export async function getFxRate(from: Currency, to: Currency): Promise<FxRateResult> {
  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      source: "identity",
    };
  }

  const entry = await loadBaseRates(from);
  const direct = entry.rates[to];
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return { from, to, rate: roundRate(direct), date: entry.date, source: entry.source };
  }

  // Invert via the `to` base if the pair wasn't listed on `from`.
  const inverted = await loadBaseRates(to);
  const back = inverted.rates[from];
  if (typeof back === "number" && Number.isFinite(back) && back > 0) {
    return {
      from,
      to,
      rate: roundRate(1 / back),
      date: inverted.date,
      source: inverted.source,
    };
  }

  throw new Error("fx_pair_unavailable");
}
