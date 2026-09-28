import type { PrismaClient } from "@prisma/client";

export interface CreateRetailerConnectionInput {
  userId: string;
  loyaltyAccountId: string;
  integrationId: string;
  externalAccountId: string;
}

export interface RetailerConnectionResult {
  id: string;
  loyaltyAccountId: string;
  integrationId: string;
  externalAccountId: string;
  status: "ACTIVE";
  connectedAt: Date;
}

export class RetailerConnectionService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async connect(
    input: CreateRetailerConnectionInput,
  ): Promise<RetailerConnectionResult> {
    const externalAccountId = input.externalAccountId.trim();

    if (!externalAccountId) {
      throw new Error("RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED");
    }

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: {
        id: input.loyaltyAccountId,
      },
      include: {
        loyaltyProgram: true,
      },
    });

    if (!account || account.userId !== input.userId) {
      throw new Error("LOYALTY_ACCOUNT_NOT_FOUND");
    }

    const integration = await this.prisma.integration.findUnique({
      where: {
        id: input.integrationId,
      },
    });

    if (!integration) {
      throw new Error("LOYALTY_INTEGRATION_NOT_FOUND");
    }

    if (integration.status !== "ACTIVE") {
      throw new Error(
        `LOYALTY_INTEGRATION_NOT_ACTIVE:${integration.status}`,
      );
    }

    if (integration.retailerId !== account.loyaltyProgram.retailerId) {
      throw new Error("LOYALTY_INTEGRATION_RETAILER_MISMATCH");
    }

    const existingConnection =
      await this.prisma.retailerConnection.findUnique({
        where: {
          loyaltyAccountId_integrationId: {
            loyaltyAccountId: input.loyaltyAccountId,
            integrationId: input.integrationId,
          },
        },
      });

    if (existingConnection) {
      throw new Error("RETAILER_CONNECTION_ALREADY_EXISTS");
    }

    const connectedAt = new Date();

    const connection =
      await this.prisma.retailerConnection.create({
        data: {
          loyaltyAccountId: input.loyaltyAccountId,
          integrationId: input.integrationId,
          externalAccountId,
          status: "ACTIVE",
          connectedAt,
        },
      });

    return {
      id: connection.id,
      loyaltyAccountId: connection.loyaltyAccountId,
      integrationId: connection.integrationId,
      externalAccountId: connection.externalAccountId!,
      status: "ACTIVE",
      connectedAt: connection.connectedAt!,
    };
  }
}
