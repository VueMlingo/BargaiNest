import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (fastify) => {
  const socketPath = process.env.DB_SOCKET_PATH;

  let adapterConfig;

  if (socketPath) {
    adapterConfig = {
      socketPath,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      connectionLimit: 5
    };
  } else {
    if (!env.DB_HOST) {
      throw new Error(
        "Database configuration error: DB_HOST is required when DB_SOCKET_PATH is not set"
      );
    }

    adapterConfig = {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      connectionLimit: 5
    };
  }

  const adapter = new PrismaMariaDb(adapterConfig);

  const prisma = new PrismaClient({
    adapter
  });

  await prisma.$connect();

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

export default prismaPlugin;
