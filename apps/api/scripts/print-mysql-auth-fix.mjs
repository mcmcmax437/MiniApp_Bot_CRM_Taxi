import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const user = process.env.MYSQL_USER || "taxi";
const password = process.env.MYSQL_PASSWORD || "taxi";
const db = process.env.MYSQL_DATABASE || "taxi";

console.log(`
MySQL auth fix for Prisma (run as MySQL root/admin):

  CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';
  GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${user}'@'localhost';
  ALTER USER '${user}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${password}';
  FLUSH PRIVILEGES;

If the user already exists, only the ALTER USER and FLUSH lines are required.

Then run: npm run dev
`);
