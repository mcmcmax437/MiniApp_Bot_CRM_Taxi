const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i;

/** Reject leftover PostgreSQL DATABASE_URL values from before the MySQL migration. */
export function assertMysqlDatabaseUrl(url, source = "DATABASE_URL") {
  if (url?.trim() && POSTGRES_URL_RE.test(url.trim())) {
    throw new Error(
      `${source} uses PostgreSQL (postgres://). This project uses MySQL only — ` +
        "remove DATABASE_URL from .env or set mysql://… from MYSQL_* variables.",
    );
  }
}

/** Build a Prisma-compatible MySQL URL for local/dev connections. */
export function buildMysqlDatabaseUrl({ user, password, host, port, database }) {
  const base =
    `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${database}`;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}allowPublicKeyRetrieval=true`;
}

export function isMysqlAuthPluginError(output) {
  const text = output.toLowerCase();
  return (
    text.includes("sha256_password") ||
    text.includes("caching_sha2_password") ||
    text.includes("unknown authentication plugin")
  );
}
