import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient, UserIdentifierType } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { RetailerConnectionService } from "../src/integrations/loyalty/connection/retailer-connection.service.js";
import { LoyaltySnapshotSyncService } from "../src/integrations/loyalty/sync/loyalty-snapshot-sync.service.js";

const runDbTests = process.env.RUN_DB_TESTS === "1";

const describeDb = runDbTests ? describe : describe.skip;

describeDb("Retailer loyalty database integration", () => {
  let prisma: PrismaClient;

  let userId: string;
  let loyaltyAccountId: string;
  let connectionId: string;
  let snapshotId: string;

  const testEmail =
    `integration-test-retailer-${Date.now()}@example.invalid`;

  beforeAll(async () => {
    const dbHost = process.env.DB_HOST ?? "127.0.0.1";
    const dbPort = Number(process.env.DB_PORT ?? "3306");
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME ?? "bargainest";

    if (!dbUser || !dbPassword) {
      throw new Error(
        "DB_USER and DB_PASSWORD are required when RUN_DB_TESTS=1",
      );
    }

    const adapter = new PrismaMariaDb({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectionLimit: 2,
    });

    prisma = new PrismaClient({
      adapter,
    });

    await prisma.$connect();

    const programme = await prisma.loyaltyProgram.findUnique({
      where: {
        id: "5381c32b-f990-491b-a1b8-92b507e596f8",
      },
    });

    if (!programme) {
      throw new Error("EXPECTED_XTRA_SAVINGS_PROGRAMME_NOT_FOUND");
    }

    const integration = await prisma.integration.findUnique({
      where: {
        id: "63eb818f-a9f2-11f1-b2b5-42010a400002",
      },
    });

    if (!integration) {
      throw new Error("EXPECTED_SHOPRITE_INTEGRATION_NOT_FOUND");
    }

    if (integration.status !== "ACTIVE") {
      throw new Error(
        `EXPECTED_SHOPRITE_INTEGRATION_ACTIVE:${integration.status}`,
      );
    }

    const user = await prisma.user.create({
      data: {
        status: "ACTIVE",
        identifiers: {
          create: {
            type: UserIdentifierType.EMAIL,
            value: testEmail,
            verified: false,
          },
        },
      },
    });

    userId = user.id;

    const account = await prisma.loyaltyAccount.create({
      data: {
        userId,
        loyaltyProgramId: programme.id,
        pointsBalance: 123,
        status: "ACTIVE",
      },
    });

    loyaltyAccountId = account.id;

    const connectionService = new RetailerConnectionService(prisma);

    const connection = await connectionService.connect({
      userId,
      loyaltyAccountId,
      integrationId: integration.id,
      externalAccountId: `MOCK-DB-TEST-${Date.now()}`,
    });

    connectionId = connection.id;

    const syncService = new LoyaltySnapshotSyncService(prisma);

    const syncResult = await syncService.syncConnection(connectionId);

    snapshotId = syncResult.snapshotId;
  });

  afterAll(async () => {
    if (prisma) {
      if (snapshotId) {
        await prisma.loyaltySnapshot.deleteMany({
          where: {
            id: snapshotId,
          },
        });
      }

      if (connectionId) {
        await prisma.retailerConnection.deleteMany({
          where: {
            id: connectionId,
          },
        });
      }

      if (loyaltyAccountId) {
        await prisma.loyaltyAccount.deleteMany({
          where: {
            id: loyaltyAccountId,
          },
        });
      }

      if (userId) {
        await prisma.user.deleteMany({
          where: {
            id: userId,
          },
        });
      }

      await prisma.$disconnect();
    }
  });

  it("creates a real retailer connection in Cloud SQL", async () => {
    const connection = await prisma.retailerConnection.findUnique({
      where: {
        id: connectionId,
      },
    });

    expect(connection).not.toBeNull();
    expect(connection?.loyaltyAccountId).toBe(loyaltyAccountId);
    expect(connection?.integrationId).toBe(
      "63eb818f-a9f2-11f1-b2b5-42010a400002",
    );
    expect(connection?.status).toBe("ACTIVE");
    expect(connection?.externalAccountId).toMatch(/^MOCK-DB-TEST-/);
    expect(connection?.connectedAt).toBeInstanceOf(Date);
  });

  it("persists the retailer-reported balance as a snapshot", async () => {
    const snapshot = await prisma.loyaltySnapshot.findUnique({
      where: {
        id: snapshotId,
      },
    });

    expect(snapshot).not.toBeNull();
    expect(Number(snapshot?.balance)).toBe(2450);
    expect(snapshot?.source).toBe("MOCK_RETAILER");
    expect(snapshot?.sourceReference).toMatch(/^MOCK-DB-TEST-/);
    expect(snapshot?.observedAt).toBeInstanceOf(Date);
    expect(snapshot?.syncedAt).toBeInstanceOf(Date);
  });

  it("does not overwrite loyaltyAccount.pointsBalance", async () => {
    const account = await prisma.loyaltyAccount.findUnique({
      where: {
        id: loyaltyAccountId,
      },
    });

    expect(Number(account?.pointsBalance)).toBe(123);
  });

  it("updates the retailer connection lastSyncedAt", async () => {
    const connection = await prisma.retailerConnection.findUnique({
      where: {
        id: connectionId,
      },
    });

    expect(connection?.lastSyncedAt).toBeInstanceOf(Date);
  });
});
