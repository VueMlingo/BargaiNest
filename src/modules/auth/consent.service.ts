import type { ConsentType, PrismaClient } from "@prisma/client";

export interface ConsentSettings {
  marketingCommunications: boolean;
  dataProcessing: boolean;
  thirdPartySharing: boolean;
}

const TYPE_TO_FIELD: Record<ConsentType, keyof ConsentSettings> = {
  MARKETING_COMMUNICATIONS: "marketingCommunications",
  DATA_PROCESSING: "dataProcessing",
  THIRD_PARTY_SHARING: "thirdPartySharing",
};

const DEFAULT_SETTINGS: ConsentSettings = {
  marketingCommunications: false,
  dataProcessing: false,
  thirdPartySharing: false,
};

export async function getConsentSettings(
  prisma: PrismaClient,
  userId: string,
): Promise<ConsentSettings> {
  const rows = await prisma.userConsent.findMany({ where: { userId } });

  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const field = TYPE_TO_FIELD[row.type];
    if (field) {
      settings[field] = row.granted;
    }
  }
  return settings;
}

export async function updateConsentSettings(
  prisma: PrismaClient,
  userId: string,
  updates: { [K in keyof ConsentSettings]?: boolean | undefined },
): Promise<ConsentSettings> {
  const fieldToType = Object.fromEntries(
    Object.entries(TYPE_TO_FIELD).map(([type, field]) => [field, type]),
  ) as Record<keyof ConsentSettings, ConsentType>;

  for (const [field, granted] of Object.entries(updates)) {
    if (granted === undefined) continue;
    const type = fieldToType[field as keyof ConsentSettings];

    await prisma.userConsent.upsert({
      where: { userId_type: { userId, type } },
      update: { granted },
      create: { userId, type, granted },
    });
  }

  return getConsentSettings(prisma, userId);
}
