/**
 * MKing GPS connector.
 *
 * MKing (aika168 / micodus platform) exposes no public API, so we replicate the
 * browser login server-side. The platform ships in slightly different skins
 * (e.g. mking.aika168.com and gps.mking.pl), but they share these endpoints,
 * all served from the portal origin:
 *
 *   GET  /UrlLoginGet.aspx?loginType=<0|1>&txtUserName=<login>&txtUserPassword=<pass>
 *        -> authenticates and redirects (HTTP and/or JS) into the app, setting the session cookie
 *   GET  /Index.aspx | /Monitor.aspx       -> authenticated shell exposing <input id="hidUserID">
 *   POST /Ajax/DevicesAjax.asmx/GetDevicesByUserID -> live position payload for all devices
 *
 * The position payload is an ASP.NET `{ "d": "<js-object-literal>" }` envelope whose
 * inner string uses unquoted keys, so we extract fields with regexes, not JSON.parse.
 */

const DEFAULT_BASE_URL = "http://mking.aika168.com";
const DEFAULT_TIMEZONE = "0:00";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 8;

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
    for (const raw of readSetCookies(res)) {
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

async function rawFetch(url: string, jar: CookieJar, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        ...(init.headers ?? {}),
        Cookie: jar.header(),
      },
    });
    jar.store(res);
    return res;
  } catch (err) {
    throw new TrackerError("tracker_unavailable", `MKing request failed: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Detects a JS redirect (`location.href='...'` / `top.location.href='...'`) in a tiny body. */
function jsRedirectTarget(body: string): string | null {
  if (body.length > 600) return null;
  const m =
    body.match(/(?:top\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
    body.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
  return m ? m[1] : null;
}

/** Follows HTTP (3xx) and JS redirects while accumulating cookies; returns the final response + URL. */
async function follow(
  startUrl: string,
  jar: CookieJar,
  init: RequestInit = {},
): Promise<{ res: Response; url: string; body: string }> {
  let url = startUrl;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await rawFetch(url, jar, i === 0 ? init : { method: "GET" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { res, url, body: "" };
      url = new URL(loc, url).toString();
      continue;
    }
    const body = await res.text().catch(() => "");
    const jsTarget = jsRedirectTarget(body);
    if (jsTarget) {
      url = new URL(jsTarget, url).toString();
      continue;
    }
    return { res, url, body };
  }
  return { res: await rawFetch(url, jar, { method: "GET" }), url, body: "" };
}

function extractInput(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`, "i");
  const alt = new RegExp(`name="${id}"[^>]*value="([^"]*)"`, "i");
  return (html.match(re) || html.match(alt) || [])[1] ?? "";
}

function isLoginPage(html: string): boolean {
  return (
    /txtAccountPassword|txtImeiPassword/i.test(html) ||
    /check your account|loginFaild|check the IMEI/i.test(html) ||
    /login\.aspx|Index\.aspx\?ReturnUrl/i.test(html)
  );
}

/**
 * Reads a field from the unquoted JS-object-literal device payload.
 * The key must start at a `{`/`,` boundary so suffix collisions like
 * `carStatus` vs `status` or `modelName` vs `name` don't mis-match.
 */
function field(payload: string, name: string): string | null {
  const re = new RegExp(`[,{]\\s*"?${name}"?\\s*:\\s*"?([^",}]*)"?`, "i");
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

interface DeviceRecord {
  raw: string;
  serial: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  fixTime: string | null;
  status: string | null;
}

/** Splits the payload into per-device chunks and parses each one. */
function parseDevices(payload: string): DeviceRecord[] {
  const records: DeviceRecord[] = [];
  // Each device object starts with `{id:<number>`.
  const re = /\{id:\d+/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(payload))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    const chunk = payload.slice(starts[i], starts[i + 1] ?? payload.length);
    records.push({
      raw: chunk,
      serial: field(chunk, "sn") ?? field(chunk, "imei"),
      name: field(chunk, "name"),
      latitude: num(field(chunk, "latitude")),
      longitude: num(field(chunk, "longitude")),
      speed: num(field(chunk, "speed")),
      course: num(field(chunk, "course")),
      fixTime: field(chunk, "deviceUtcDate"),
      status: field(chunk, "status"),
    });
  }
  return records;
}

function hasFix(d: DeviceRecord): boolean {
  return (
    d.latitude != null &&
    d.longitude != null &&
    !(d.latitude === -1 && d.longitude === -1) &&
    !(d.latitude === 0 && d.longitude === 0)
  );
}

function toPosition(d: DeviceRecord): TrackerPosition {
  const status = d.status;
  const offline = status != null && /offline|loggedoff|expire/i.test(status);
  return {
    deviceName: d.name,
    latitude: d.latitude ?? 0,
    longitude: d.longitude ?? 0,
    speed: d.speed,
    course: d.course,
    fixTime: d.fixTime,
    status,
    online: !offline,
    hasFix: hasFix(d),
  };
}

/** Picks the device matching the login serial, else the first device with a fix. */
function pickDevice(devices: DeviceRecord[], login: string): DeviceRecord | null {
  if (!devices.length) return null;
  const needle = login.trim();
  const match = devices.find(
    (d) => (d.serial && d.serial.includes(needle)) || (d.name && d.name.includes(needle)),
  );
  if (match) return match;
  return devices.find(hasFix) ?? devices[0];
}

async function loginViaUrl(
  base: string,
  creds: MkingCredentials,
  loginType: TrackerLoginType,
  jar: CookieJar,
): Promise<boolean> {
  const q = new URLSearchParams({
    loginType: loginType === "DEVICE" ? "1" : "0",
    txtUserName: creds.login,
    txtUserPassword: creds.password,
  });
  const { body } = await follow(`${base}/UrlLoginGet.aspx?${q.toString()}`, jar);
  if (/check your account|check the IMEI|loginFaild/i.test(body)) return false;
  // We are authenticated as long as we are not staring at the login form again.
  return !isLoginPage(body) || /hidUserID/i.test(body);
}

async function resolveUserId(base: string, jar: CookieJar): Promise<string | null> {
  for (const path of ["/Index.aspx", "/Monitor.aspx", "/Distributor.aspx"]) {
    const { body } = await follow(`${base}${path}`, jar);
    const userId = extractInput(body, "hidUserID");
    if (userId) return userId;
  }
  return null;
}

async function fetchDevicePayload(
  base: string,
  userId: string,
  jar: CookieJar,
): Promise<string | null> {
  const res = await rawFetch(`${base}/Ajax/DevicesAjax.asmx/GetDevicesByUserID`, jar, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      UserID: Number(userId),
      isFirst: true,
      TimeZones: DEFAULT_TIMEZONE,
      DeviceID: 0,
    }),
  });
  if (!res.ok) return null;
  const envelope = (await res.json().catch(() => null)) as { d?: string } | null;
  if (!envelope || typeof envelope.d !== "string") return null;
  return envelope.d;
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

  let authenticated = false;
  let sawNoFix = false;
  for (const loginType of order) {
    const jar = new CookieJar();
    if (!(await loginViaUrl(base, creds, loginType, jar))) continue;
    const userId = await resolveUserId(base, jar);
    if (!userId) continue;
    authenticated = true;
    const payload = await fetchDevicePayload(base, userId, jar);
    if (payload == null) continue;
    const device = pickDevice(parseDevices(payload), creds.login);
    if (!device) continue;
    const position = toPosition(device);
    if (!position.hasFix) {
      sawNoFix = true;
      continue;
    }
    return position;
  }

  if (sawNoFix) throw new TrackerError("tracker_no_fix");
  if (authenticated) throw new TrackerError("tracker_unavailable");
  throw new TrackerError("tracker_login_failed");
}
