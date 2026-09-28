import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const retailers = await prisma.retailer.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      branches: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
        },
        orderBy: {
          name: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(JSON.stringify(retailers, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
