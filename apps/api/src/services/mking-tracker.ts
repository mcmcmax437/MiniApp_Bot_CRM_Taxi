/**
 * MKing GPS connector.
 *
 * MKing (aika168 platform) exposes no public API, so we replicate the browser
 * login flow server-side:
 *   1. GET  /LoginPage/mking/index.aspx        -> read ASP.NET __VIEWSTATE / __EVENTVALIDATION + cookies
 *   2. POST /LoginPage/mking/index.aspx        -> authenticate (device-id or account login), keep session cookie
 *   3. GET  /Monitor.aspx                       -> read hidUserID / hidDeviceID
 *   4. POST /Ajax/DevicesAjax.asmx/GetDevicesByUserID -> live position payload
 *
 * The position payload is an ASP.NET `{ "d": "<js-object-literal>" }` envelope whose
 * inner string uses unquoted keys, so we extract the fields we need with regexes
 * rather than JSON.parse.
 */

const DEFAULT_BASE_URL = "http://mking.aika168.com";
const DEFAULT_TIMEZONE = "Central European Standard Time";
const REQUEST_TIMEOUT_MS = 15_000;

export type TrackerLoginType = "DEVICE" | "ACCOUNT";

export interface MkingCredentials {
  /** Portal base URL or login URL; only the origin is used. */
  baseUrl?: string | null;
  /** Device ID / Car No. (device login) or account name (account login). */
  login: string;
  password: string;
  /** Defaults to DEVICE (login by ID number), with ACCOUNT as fallback. */
  loginType?: TrackerLoginType;
}

export interface TrackerPosition {
  deviceName: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  course: number | null;
  /** Raw timestamp string reported by the platform (server-local time). */
  fixTime: string | null;
  status: string | null;
  online: boolean;
  /** True when the platform returned a usable GPS fix. */
  hasFix: boolean;
}

export type TrackerErrorCode =
  | "tracker_not_configured"
  | "tracker_login_failed"
  | "tracker_no_fix"
  | "tracker_unavailable";

export class TrackerError extends Error {
  code: TrackerErrorCode;
  constructor(code: TrackerErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "TrackerError";
  }
}

/** Minimal cookie jar: name -> value, serialized back into a Cookie header. */
class CookieJar {
  private jar = new Map<string, string>();

  store(res: Response): void {
    const setCookies = readSetCookies(res);
    for (const raw of setCookies) {
      const pair = raw.split(";", 1)[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function readSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie();
    if (list && list.length) return list;
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function originOf(url: string | null | undefined): string {
  if (!url) return DEFAULT_BASE_URL;
  try {
    return new URL(url).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
  } catch (err) {
    throw new TrackerError("tracker_unavailable", `MKing request failed: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

function extractInput(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`, "i");
  const alt = new RegExp(`name="${id}"[^>]*value="([^"]*)"`, "i");
  return (html.match(re) || html.match(alt) || [])[1] ?? "";
}

/** Reads a field from the unquoted JS-object-literal device payload. */
function field(payload: string, name: string): string | null {
  const re = new RegExp(`"?${name}"?\\s*:\\s*"?([^",}]*)"?`, "i");
  const m = payload.match(re);
  if (!m) return null;
  const value = m[1].trim();
  return value.length ? value : null;
}

function num(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function login(base: string, creds: MkingCredentials, jar: CookieJar): Promise<boolean> {
  const loginUrl = `${base}/LoginPage/mking/index.aspx`;
  const pageRes = await timedFetch(loginUrl, { method: "GET" });
  jar.store(pageRes);
  const html = await pageRes.text();

  const viewState = extractInput(html, "__VIEWSTATE");
  const eventValidation = extractInput(html, "__EVENTVALIDATION");

  const isDevice = (creds.loginType ?? "DEVICE") === "DEVICE";
  const body = new URLSearchParams();
  if (viewState) body.set("__VIEWSTATE", viewState);
  if (eventValidation) body.set("__EVENTVALIDATION", eventValidation);
  body.set("LType", isDevice ? "1" : "0");
  body.set("txtUserName", isDevice ? "" : creds.login);
  body.set("txtAccountPassword", isDevice ? "" : creds.password);
  body.set("txtImeiNo", isDevice ? creds.login : "");
  body.set("txtImeiPassword", isDevice ? creds.password : "");
  body.set("btnLogin", "Login");

  const res = await timedFetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: loginUrl,
    },
    body: body.toString(),
  });
  jar.store(res);

  // Success either redirects (302 -> Monitor.aspx) or returns a JS redirect page.
  if (res.status === 302) return true;
  const text = await res.text().catch(() => "");
  if (/check your account|loginFaild\(\)|check the IMEI/i.test(text)) return false;
  // A returned login form (with the password fields) means we are still not authenticated.
  return !/id="txtImeiPassword"/i.test(text) || /Monitor\.aspx/i.test(text);
}

interface MonitorContext {
  userId: string;
  deviceId: string;
}

async function readMonitorContext(base: string, jar: CookieJar): Promise<MonitorContext | null> {
  const res = await timedFetch(`${base}/Monitor.aspx`, {
    method: "GET",
    headers: { Cookie: jar.header() },
  });
  jar.store(res);
  if (res.status === 302) return null;
  const html = await res.text();
  const userId = extractInput(html, "hidUserID");
  const deviceId = extractInput(html, "hidDeviceID");
  if (!userId) return null;
  return { userId, deviceId };
}

async function fetchDevicePayload(
  base: string,
  ctx: MonitorContext,
  jar: CookieJar,
): Promise<string | null> {
  const res = await timedFetch(`${base}/Ajax/DevicesAjax.asmx/GetDevicesByUserID`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Cookie: jar.header(),
    },
    body: JSON.stringify({
      UserID: Number(ctx.userId),
      isFirst: true,
      TimeZones: DEFAULT_TIMEZONE,
      DeviceID: ctx.deviceId ? Number(ctx.deviceId) : 0,
    }),
  });
  if (!res.ok) return null;
  const envelope = (await res.json().catch(() => null)) as { d?: string } | null;
  if (!envelope || typeof envelope.d !== "string") return null;
  return envelope.d;
}

function parsePosition(payload: string): TrackerPosition {
  // Isolate the first device object so regexes don't cross device boundaries.
  const start = payload.indexOf("{", payload.indexOf("devices"));
  const deviceChunk = start >= 0 ? payload.slice(start) : payload;

  const lat = num(field(deviceChunk, "latitude"));
  const lng = num(field(deviceChunk, "longitude"));
  const status = field(deviceChunk, "status");
  const online = status != null && !/LoggedOff/i.test(status);

  const hasFix =
    lat != null &&
    lng != null &&
    !(lat === -1 && lng === -1) &&
    !(lat === 0 && lng === 0);

  return {
    deviceName: field(deviceChunk, "name"),
    latitude: lat ?? 0,
    longitude: lng ?? 0,
    speed: num(field(deviceChunk, "speed")),
    course: num(field(deviceChunk, "course")),
    fixTime: field(deviceChunk, "deviceUtcDate"),
    status,
    online,
    hasFix,
  };
}

/**
 * Logs into MKing and returns the live position for the configured device.
 * Tries the configured login type first, then falls back to the other type.
 */
export async function fetchMkingPosition(creds: MkingCredentials): Promise<TrackerPosition> {
  if (!creds.login?.trim() || !creds.password?.trim()) {
    throw new TrackerError("tracker_not_configured");
  }
  const base = originOf(creds.baseUrl);
  const primary: TrackerLoginType = creds.loginType ?? "DEVICE";
  const order: TrackerLoginType[] = primary === "DEVICE" ? ["DEVICE", "ACCOUNT"] : ["ACCOUNT", "DEVICE"];

  let lastContext: MonitorContext | null = null;
  for (const loginType of order) {
    const jar = new CookieJar();
    const ok = await login(base, { ...creds, loginType }, jar);
    if (!ok) continue;
    const ctx = await readMonitorContext(base, jar);
    if (!ctx) continue;
    lastContext = ctx;
    const payload = await fetchDevicePayload(base, ctx, jar);
    if (payload == null) continue;
    const position = parsePosition(payload);
    if (!position.hasFix) {
      throw new TrackerError("tracker_no_fix");
    }
    return position;
  }

  if (lastContext) throw new TrackerError("tracker_unavailable");
  throw new TrackerError("tracker_login_failed");
}
