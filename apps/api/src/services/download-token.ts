import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

const TOKEN_TTL_SECONDS = 120;

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", env.botToken).update(payload).digest());
}

/**
 * Short-lived HMAC token so Telegram's native `downloadFile` can fetch a
 * document over HTTPS without an Authorization header (WebView limitation).
 */
export function mintDocumentDownloadToken(documentId: string, ownerId: string): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${documentId}.${ownerId}.${expiresAt}`;
  return { token: `${b64url(Buffer.from(payload, "utf8"))}.${sign(payload)}`, expiresAt };
}

export function verifyDocumentDownloadToken(
  token: string,
  documentId: string,
): { ownerId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  let payload: string;
  try {
    payload = fromB64url(payloadB64).toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [docId, ownerId, expStr] = payload.split(".");
  if (!docId || !ownerId || !expStr) return null;
  if (docId !== documentId) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return { ownerId };
}
