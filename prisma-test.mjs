import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

console.log('Creating Prisma adapter...');

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  connectTimeout: 10000
});

console.log('Creating PrismaClient...');

const prisma = new PrismaClient({ adapter });

console.log('Calling Prisma connect...');

try {
  await prisma.$connect();

  console.log('PRISMA CONNECTION SUCCESSFUL');

  const result = await prisma.$queryRaw`
    SELECT VERSION() AS version, DATABASE() AS database_name
  `;

  console.log(result);

  await prisma.$disconnect();

  console.log('PRISMA DISCONNECTED CLEANLY');

  process.exit(0);
} catch (error) {
  console.error('===== PRISMA CONNECTION FAILED =====');
  console.error(error);
  console.error('====================================');

  try {
    await prisma.$disconnect();
  } catch {}

  process.exit(1);
}
