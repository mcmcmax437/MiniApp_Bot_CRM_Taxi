import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log("MySQL connection OK:", rows);
} catch (err) {
  console.error("MySQL connection failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
