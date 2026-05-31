import crypto from "node:crypto";

export interface TelegramUser {
  id: bigint;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: number;
  raw: string;
}

/**
 * Validate Telegram Mini App `initData` per the official algorithm:
 *  - secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 *  - data_check_string = sorted "key=value" pairs (excluding hash) joined by "\n"
 *  - expected hash = HMAC_SHA256(key=secret_key, message=data_check_string) in hex
 * Returns the parsed user or throws on failure.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
): ValidatedInitData {
  if (!initData) {
    throw new Error("Empty initData");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("initData is missing hash");
  }

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const valid =
    computedHash.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(hash, "hex"));

  if (!valid) {
    throw new Error("initData signature mismatch");
  }

  const authDate = Number(params.get("auth_date") ?? "0");
  if (maxAgeSeconds > 0) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > maxAgeSeconds) {
      throw new Error("initData is expired");
    }
  }

  const userJson = params.get("user");
  if (!userJson) {
    throw new Error("initData is missing user");
  }

  const parsed = JSON.parse(userJson) as Record<string, unknown>;
  if (typeof parsed.id !== "number" && typeof parsed.id !== "string") {
    throw new Error("initData user has no id");
  }

  const user: TelegramUser = {
    id: BigInt(parsed.id as number),
    first_name: parsed.first_name as string | undefined,
    last_name: parsed.last_name as string | undefined,
    username: parsed.username as string | undefined,
    language_code: parsed.language_code as string | undefined,
  };

  return { user, authDate, raw: initData };
}

export function deriveLocale(languageCode?: string): "uk" | "ru" | "en" {
  if (!languageCode) return "uk";
  const code = languageCode.toLowerCase();
  if (code.startsWith("uk")) return "uk";
  if (code.startsWith("ru")) return "ru";
  return "en";
}

export function fullNameOf(user: TelegramUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
}
