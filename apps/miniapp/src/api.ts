import { getInitData } from "./telegram";
import type {
  FleetTrackerLocations,
  FleetTrackerProgress,
  FleetTrackerProgressCar,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `tma ${getInitData()}`,
  };
  if (options.body != null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    try {
      const data = await res.json();
      code = data.error;
      message = data.message ?? data.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `tma ${getInitData()}` },
    body: formData,
  });
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const data = await res.json();
      code = data.error;
      message = data.message ?? data.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message, code);
  }
  return (await res.json()) as T;
}

export function apiFileUrl(documentId: string): string {
  return `${BASE}/documents/${documentId}/file`;
}

/** Stream fleet GPS with per-car progress (?progress=1 NDJSON). */
export async function fetchFleetTrackerLocations(
  options: {
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (progress: FleetTrackerProgress) => void;
  } = {},
): Promise<FleetTrackerLocations> {
  const url = new URL(`${BASE}/cars/tracker/locations`, window.location.origin);
  url.searchParams.set("progress", "1");
  if (options.force) url.searchParams.set("refresh", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `tma ${getInitData()}`,
      Accept: "application/x-ndjson",
    },
    signal: options.signal,
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    try {
      const data = await res.json();
      code = data.error;
      message = data.message ?? data.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message, code);
  }

  if (!res.body) throw new ApiError(502, "empty_body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: FleetTrackerLocations | null = null;
  let cars: FleetTrackerProgressCar[] = [];
  let total = 0;
  let done = 0;

  const emit = (plate?: string) => {
    options.onProgress?.({ done, total, plate, cars: cars.map((c) => ({ ...c })) });
  };

  const handleEvent = (event: Record<string, unknown>) => {
    if (event.type === "start") {
      total = Number(event.total) || 0;
      done = 0;
      const listed = Array.isArray(event.cars) ? (event.cars as FleetTrackerProgressCar[]) : [];
      cars = listed.map((car) => ({
        id: car.id,
        plate: car.plate,
        make: car.make ?? null,
        model: car.model ?? null,
        status: "pending",
      }));
      emit();
      return;
    }
    if (event.type === "progress") {
      done = Number(event.done) || done + 1;
      total = Number(event.total) || total;
      const id = String(event.id ?? "");
      const plate = String(event.plate ?? "");
      const status = event.status === "located" ? "located" : "missing";
      const idx = cars.findIndex((c) => c.id === id);
      const row: FleetTrackerProgressCar = {
        id,
        plate,
        make: (event.make as string | null) ?? null,
        model: (event.model as string | null) ?? null,
        status,
        error: typeof event.error === "string" ? event.error : undefined,
      };
      if (idx >= 0) cars[idx] = row;
      else cars.push(row);
      emit(plate);
      return;
    }
    if (event.type === "done") {
      result = {
        located: Array.isArray(event.located) ? (event.located as FleetTrackerLocations["located"]) : [],
        missing: Array.isArray(event.missing) ? (event.missing as FleetTrackerLocations["missing"]) : [],
      };
    }
  };

  while (true) {
    const { done: eof, value } = await reader.read();
    if (eof) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      handleEvent(JSON.parse(trimmed) as Record<string, unknown>);
    }
  }

  const tail = buffer.trim();
  if (tail) handleEvent(JSON.parse(tail) as Record<string, unknown>);

  if (!result) throw new ApiError(502, "incomplete_stream");
  return result;
}
