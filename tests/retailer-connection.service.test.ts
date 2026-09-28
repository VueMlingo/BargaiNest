import { describe, expect, it, vi } from "vitest";
import { RetailerConnectionService } from "../src/integrations/loyalty/connection/retailer-connection.service.js";

describe("RetailerConnectionService", () => {
  it("creates an active retailer connection for the account owner", async () => {
    const connectionCreate = vi.fn().mockResolvedValue({
      id: "connection-001",
      loyaltyAccountId: "account-001",
      integrationId: "integration-001",
      externalAccountId: "MOCK-EXTERNAL-001",
      status: "ACTIVE",
      connectedAt: new Date("2026-09-06T12:00:00.000Z"),
    });

    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-001",
          loyaltyProgramId: "program-001",
          pointsBalance: 999,
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-001",
          },
        }),
      },
      integration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "integration-001",
          retailerId: "retailer-001",
          code: "SHOPRITE_XTRA_SAVINGS",
          status: "ACTIVE",
        }),
      },
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: connectionCreate,
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    const result = await service.connect({
      userId: "user-001",
      loyaltyAccountId: "account-001",
      integrationId: "integration-001",
      externalAccountId: " MOCK-EXTERNAL-001 ",
    });

    expect(result.id).toBe("connection-001");
    expect(result.loyaltyAccountId).toBe("account-001");
    expect(result.integrationId).toBe("integration-001");
    expect(result.externalAccountId).toBe("MOCK-EXTERNAL-001");
    expect(result.status).toBe("ACTIVE");

    expect(connectionCreate).toHaveBeenCalledOnce();

    const createCall = connectionCreate.mock.calls.at(0)?.[0];

    expect(createCall.data.loyaltyAccountId).toBe("account-001");
    expect(createCall.data.integrationId).toBe("integration-001");
    expect(createCall.data.externalAccountId).toBe(
      "MOCK-EXTERNAL-001",
    );
    expect(createCall.data.status).toBe("ACTIVE");
    expect(createCall.data.connectedAt).toBeInstanceOf(Date);
  });

  it("rejects access when the loyalty account belongs to another user", async () => {
    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-A",
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-001",
          },
        }),
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-B",
        loyaltyAccountId: "account-001",
        integrationId: "integration-001",
        externalAccountId: "MOCK-EXTERNAL-001",
      }),
    ).rejects.toThrow("LOYALTY_ACCOUNT_NOT_FOUND");
  });

  it("rejects a missing integration", async () => {
    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-001",
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-001",
          },
        }),
      },
      integration: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-001",
        loyaltyAccountId: "account-001",
        integrationId: "missing-integration",
        externalAccountId: "MOCK-EXTERNAL-001",
      }),
    ).rejects.toThrow("LOYALTY_INTEGRATION_NOT_FOUND");
  });

  it("rejects an inactive integration", async () => {
    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-001",
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-001",
          },
        }),
      },
      integration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "integration-001",
          retailerId: "retailer-001",
          status: "DEVELOPMENT",
        }),
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-001",
        loyaltyAccountId: "account-001",
        integrationId: "integration-001",
        externalAccountId: "MOCK-EXTERNAL-001",
      }),
    ).rejects.toThrow(
      "LOYALTY_INTEGRATION_NOT_ACTIVE:DEVELOPMENT",
    );
  });

  it("rejects an integration belonging to another retailer", async () => {
    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-001",
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-A",
          },
        }),
      },
      integration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "integration-001",
          retailerId: "retailer-B",
          status: "ACTIVE",
        }),
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-001",
        loyaltyAccountId: "account-001",
        integrationId: "integration-001",
        externalAccountId: "MOCK-EXTERNAL-001",
      }),
    ).rejects.toThrow(
      "LOYALTY_INTEGRATION_RETAILER_MISMATCH",
    );
  });

  it("rejects a duplicate connection", async () => {
    const prisma = {
      loyaltyAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-001",
          userId: "user-001",
          loyaltyProgram: {
            id: "program-001",
            retailerId: "retailer-001",
          },
        }),
      },
      integration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "integration-001",
          retailerId: "retailer-001",
          status: "ACTIVE",
        }),
      },
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "existing-connection",
        }),
      },
    } as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-001",
        loyaltyAccountId: "account-001",
        integrationId: "integration-001",
        externalAccountId: "MOCK-EXTERNAL-001",
      }),
    ).rejects.toThrow("RETAILER_CONNECTION_ALREADY_EXISTS");
  });

  it("rejects an empty external retailer account id", async () => {
    const prisma = {} as any;

    const service = new RetailerConnectionService(prisma);

    await expect(
      service.connect({
        userId: "user-001",
        loyaltyAccountId: "account-001",
        integrationId: "integration-001",
        externalAccountId: "   ",
      }),
    ).rejects.toThrow(
      "RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED",
    );
  });
});
