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
/**
 * The GetDevicesByUserID endpoint formats timestamps with a server-side
 * TimeZoneInfo lookup, and different MKing skins expect different formats:
 * aika168 wants a Windows time-zone id, gps.mking.pl wants a GMT offset.
 * An unexpected value makes the .NET server throw, so we try these in order.
 */
const TIMEZONE_CANDIDATES = ["Central European Standard Time", "0:00", "2:00"];
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

interface MonitorContext {
  userId: string;
  deviceId: string;
}

/** Returns all hidden <input> name/value pairs from an ASP.NET form. */
function parseHidden(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = (tag.match(/name="([^"]*)"/) || [])[1];
    const value = (tag.match(/value="([^"]*)"/) || [])[1] ?? "";
    if (name) out[name] = value;
  }
  return out;
}

/** Candidate login-page URLs, preferring the one saved on the car. */
function loginPageCandidates(base: string, trackerUrl: string | null | undefined): string[] {
  const candidates: string[] = [];
  if (trackerUrl) {
    try {
      const u = new URL(trackerUrl);
      if (/\/LoginPage\/.*\.aspx$/i.test(u.pathname)) candidates.push(u.href);
    } catch {
      /* ignore malformed URL */
    }
  }
  candidates.push(`${base}/LoginPage/mking/login.aspx`);
  candidates.push(`${base}/LoginPage/mking/index.aspx`);
  return [...new Set(candidates)];
}

/**
 * Authenticates via the ASP.NET form postback (works for device login on every
 * MKing skin, unlike UrlLoginGet). Echoes back all hidden fields, then overrides
 * the credentials for the chosen login type.
 */
async function loginPostback(
  base: string,
  trackerUrl: string | null | undefined,
  creds: MkingCredentials,
  loginType: TrackerLoginType,
  jar: CookieJar,
): Promise<boolean> {
  const isDevice = loginType === "DEVICE";
  for (const loginUrl of loginPageCandidates(base, trackerUrl)) {
    const pageRes = await rawFetch(loginUrl, jar, { method: "GET" });
    const html = await pageRes.text().catch(() => "");
    if (!/txtImeiNo|txtUserName/i.test(html)) continue;

    const body = new URLSearchParams(parseHidden(html));
    body.set("LType", isDevice ? "1" : "0");
    body.set("txtUserName", isDevice ? "" : creds.login);
    body.set("txtAccountPassword", isDevice ? "" : creds.password);
    body.set("txtImeiNo", isDevice ? creds.login : "");
    body.set("txtImeiPassword", isDevice ? creds.password : "");
    body.set("btnLogin", "Login");

    // The postback sets the session cookie on success. The returned HTML always
    // contains the loginFaild() definition, so success can't be read from the
    // body; resolveContext() is the authority on whether the session is authed.
    await follow(loginUrl, jar, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: loginUrl },
      body: body.toString(),
    });
    return true;
  }
  return false;
}

/** Fallback GET login (works for account login / micodus skin). */
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
  return !isLoginPage(body) || /hidUserID/i.test(body);
}

async function resolveContext(base: string, jar: CookieJar): Promise<MonitorContext | null> {
  for (const path of ["/Index.aspx", "/Monitor.aspx", "/Distributor.aspx"]) {
    const { body } = await follow(`${base}${path}`, jar);
    const userId = extractInput(body, "hidUserID");
    if (userId) return { userId, deviceId: extractInput(body, "hidDeviceID") };
  }
  return null;
}

async function fetchDevicePayload(
  base: string,
  ctx: MonitorContext,
  jar: CookieJar,
): Promise<string | null> {
  // Prefer the account's currently-selected device to avoid pulling a huge
  // device tree on reseller accounts; fall back to all devices (DeviceID 0).
  const deviceIds = ctx.deviceId ? [Number(ctx.deviceId), 0] : [0];
  for (const deviceId of deviceIds) {
    for (const tz of TIMEZONE_CANDIDATES) {
      const res = await rawFetch(`${base}/Ajax/DevicesAjax.asmx/GetDevicesByUserID`, jar, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          UserID: Number(ctx.userId),
          isFirst: true,
          TimeZones: tz,
          DeviceID: deviceId,
        }),
      });
      if (!res.ok) continue;
      const envelope = (await res.json().catch(() => null)) as { d?: string } | null;
      if (envelope && typeof envelope.d === "string" && /\{id:\d+/.test(envelope.d)) {
        return envelope.d;
      }
    }
  }
  return null;
}

/**
 * Logs into MKing and returns the live position for the configured device.
 * Tries postback then GET login, for the configured login type then the other.
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
    for (const attempt of ["postback", "urlget"] as const) {
      const jar = new CookieJar();
      const ok =
        attempt === "postback"
          ? await loginPostback(base, creds.baseUrl, creds, loginType, jar)
          : await loginViaUrl(base, creds, loginType, jar);
      if (!ok) continue;
      const ctx = await resolveContext(base, jar);
      if (!ctx) continue;
      authenticated = true;
      const payload = await fetchDevicePayload(base, ctx, jar);
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
  }

  if (sawNoFix) throw new TrackerError("tracker_no_fix");
  if (authenticated) throw new TrackerError("tracker_unavailable");
  throw new TrackerError("tracker_login_failed");
}
