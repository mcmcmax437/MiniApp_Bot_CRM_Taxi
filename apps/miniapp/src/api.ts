import { getInitData } from "./telegram";

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

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `tma ${getInitData()}`,
    },
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
