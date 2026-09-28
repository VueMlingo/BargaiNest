import { buildApp } from "./src/app/app.js";

async function main() {
  const app = await buildApp();

  try {
    const sources = await app.prisma.catalogueSource.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        adapterKey: true,
        storeCode: true,
        sourcePriority: true,
        retailerId: true,
        channel: true,
        sourceType: true,
        countryCode: true,
        province: true,
        city: true,
      },
      orderBy: {
        code: "asc",
      },
    });

    console.log(JSON.stringify(sources, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
