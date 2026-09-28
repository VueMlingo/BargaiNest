import "dotenv/config";
import { defineConfig } from "prisma/config";

const dbHost = process.env.DB_HOST ?? "127.0.0.1";
const dbPort = process.env.DB_PORT ?? "3306";
const dbUser = process.env.DB_USER ?? "placeholder";
const dbPassword = process.env.DB_PASSWORD ?? "placeholder";
const dbName = process.env.DB_NAME ?? "bargainest";

const databaseUrl =
  `mysql://${encodeURIComponent(dbUser)}` +
  `:${encodeURIComponent(dbPassword)}` +
  `@${dbHost}:${dbPort}/${dbName}`;

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: databaseUrl,
  },
});
