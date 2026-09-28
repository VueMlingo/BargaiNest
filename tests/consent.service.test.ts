import { describe, expect, it, vi } from "vitest";
import { getConsentSettings, updateConsentSettings } from "../src/modules/auth/consent.service.js";

describe("getConsentSettings", () => {
  it("defaults every consent to false when no rows exist yet", async () => {
    const prisma = { userConsent: { findMany: vi.fn().mockResolvedValue([]) } } as any;
    const settings = await getConsentSettings(prisma, "user-1");
    expect(settings).toEqual({
      marketingCommunications: false,
      dataProcessing: false,
      thirdPartySharing: false,
    });
  });

  it("reflects stored rows, leaving unset types at their default", async () => {
    const prisma = {
      userConsent: {
        findMany: vi.fn().mockResolvedValue([
          { type: "MARKETING_COMMUNICATIONS", granted: true },
        ]),
      },
    } as any;

    const settings = await getConsentSettings(prisma, "user-1");
    expect(settings.marketingCommunications).toBe(true);
    expect(settings.dataProcessing).toBe(false); // untouched, stays default
  });

  it("does not throw on an unrecognized consent type from the DB (defensive guard)", async () => {
    const prisma = {
      userConsent: {
        findMany: vi.fn().mockResolvedValue([{ type: "SOME_FUTURE_TYPE", granted: true }]),
      },
    } as any;

    await expect(getConsentSettings(prisma, "user-1")).resolves.toBeDefined();
  });
});

describe("updateConsentSettings", () => {
  it("upserts only the fields provided, ignoring undefined ones", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      userConsent: {
        upsert,
        findMany: vi.fn().mockResolvedValue([{ type: "MARKETING_COMMUNICATIONS", granted: true }]),
      },
    } as any;

    await updateConsentSettings(prisma, "user-1", {
      marketingCommunications: true,
      dataProcessing: undefined,
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_type: { userId: "user-1", type: "MARKETING_COMMUNICATIONS" } },
        update: { granted: true },
      }),
    );
  });

  it("returns the resulting full settings object after updating", async () => {
    const prisma = {
      userConsent: {
        upsert: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([{ type: "DATA_PROCESSING", granted: true }]),
      },
    } as any;

    const result = await updateConsentSettings(prisma, "user-1", { dataProcessing: true });
    expect(result.dataProcessing).toBe(true);
  });
});
