/**
 * Apply a single missing column when migration history says applied but column is absent.
 * Safe additive-only — does not drop data.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(apiDir, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });

if (process.env.USE_VPS_TUNNEL === "1") {
  const port = process.env.VPS_TUNNEL_LOCAL_PORT?.trim() || "3307";
  process.env.MYSQL_HOST = "127.0.0.1";
  process.env.LOCAL_DB_PORT = port;
  process.env.MYSQL_USER = process.env.VPS_MYSQL_USER?.trim() || process.env.MYSQL_USER;
  process.env.MYSQL_PASSWORD = process.env.VPS_MYSQL_PASSWORD?.trim() || process.env.MYSQL_PASSWORD;
  process.env.MYSQL_DATABASE = process.env.VPS_MYSQL_DATABASE?.trim() || process.env.MYSQL_DATABASE;
  delete process.env.DATABASE_URL;
}

await import("./load-env.mjs");
const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

try {
  const columns = await prisma.$queryRaw`SHOW COLUMNS FROM Expense`;
  const colNames = columns.map((c) => c.Field);
  if (colNames.includes("paidByFather")) {
    console.log("paidByFather already exists — nothing to do.");
    process.exit(0);
  }

  await prisma.$executeRawUnsafe(
    "ALTER TABLE `Expense` ADD COLUMN `paidByFather` BOOLEAN NOT NULL DEFAULT false",
  );
  console.log("Added paidByFather column to Expense.");
} catch (err) {
  console.error("Fix failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
