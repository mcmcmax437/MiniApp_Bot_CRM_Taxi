/**
 * Read-only DB inspection — expense count and Expense columns.
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
  const [{ count }] = await prisma.$queryRaw`SELECT COUNT(*) AS count FROM Expense`;
  const columns = await prisma.$queryRaw`SHOW COLUMNS FROM Expense`;
  const colNames = columns.map((c) => c.Field);
  console.log("Expense row count:", Number(count));
  console.log("paidByFather column:", colNames.includes("paidByFather") ? "yes" : "NO");
  console.log("Columns:", colNames.join(", "));
} catch (err) {
  console.error("Inspect failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
