import { describe, expect, it, vi } from "vitest";
import {
  createWalletVoucher,
  listWalletVouchersForUser,
  getWalletVoucherForUser,
  redeemWalletVoucher,
  computeEffectiveStatus,
} from "../src/modules/wallet-vouchers/wallet-voucher.service.js";

describe("computeEffectiveStatus", () => {
  it("returns REDEEMED regardless of expiry once actually redeemed", () => {
    const pastExpiry = new Date("2020-01-01");
    expect(computeEffectiveStatus("REDEEMED", pastExpiry)).toBe("REDEEMED");
    expect(computeEffectiveStatus("REDEEMED", null)).toBe("REDEEMED");
  });

  it("returns EXPIRED for an ACTIVE voucher past its expiry date", () => {
    const now = new Date("2026-09-22T12:00:00.000Z");
    const pastExpiry = new Date("2026-09-22T11:59:59.000Z");
    expect(computeEffectiveStatus("ACTIVE", pastExpiry, now)).toBe("EXPIRED");
  });

  it("returns EXPIRED exactly at the expiry instant, not just after it", () => {
    const now = new Date("2026-09-22T12:00:00.000Z");
    expect(computeEffectiveStatus("ACTIVE", now, now)).toBe("EXPIRED");
  });

  it("returns ACTIVE for a voucher with no expiry date at all", () => {
    expect(computeEffectiveStatus("ACTIVE", null)).toBe("ACTIVE");
  });

  it("returns ACTIVE for a voucher whose expiry is still in the future", () => {
    const now = new Date("2026-09-22T12:00:00.000Z");
    const futureExpiry = new Date("2026-12-31T23:59:59.000Z");
    expect(computeEffectiveStatus("ACTIVE", futureExpiry, now)).toBe("ACTIVE");
  });
});

describe("createWalletVoucher", () => {
  it("creates a voucher with all fields when a matching retailer exists (exact name match)", async () => {
    const create = vi.fn().mockResolvedValue({ id: "v1" });
    const findFirst = vi.fn().mockResolvedValue({ id: "retailer-1" });
    const prisma = {
      walletVoucher: { create },
      retailer: { findFirst },
    } as any;

    await createWalletVoucher(prisma, "user-1", {
      retailerName: "Woolworths",
      barcode: "1234567890128",
      barcodeFormat: "ean_13",
      value: 50,
      currency: "ZAR",
      expiresAt: new Date("2026-12-31"),
      sourcePurchaseId: "purchase-1",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        retailerId: "retailer-1",
        retailerName: "Woolworths",
        barcode: "1234567890128",
        value: 50,
      }),
    });
  });

  it("falls back to a case-insensitive retailer match when the exact name doesn't match", async () => {
    const create = vi.fn().mockResolvedValue({ id: "v1" });
    const findFirst = vi.fn()
      .mockResolvedValueOnce(null) // exact match fails
      .mockResolvedValueOnce({ id: "retailer-1" }); // case-insensitive match succeeds
    const prisma = {
      walletVoucher: { create },
      retailer: { findFirst },
    } as any;

    await createWalletVoucher(prisma, "user-1", {
      retailerName: "woolworths",
      barcode: "XYZ",
      value: 10,
    });

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ retailerId: "retailer-1" }),
    });
  });

  it("still creates the voucher with retailerId null when no matching retailer exists at all -- not an error", async () => {
    const create = vi.fn().mockResolvedValue({ id: "v1" });
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      walletVoucher: { create },
      retailer: { findFirst },
    } as any;

    await createWalletVoucher(prisma, "user-1", {
      retailerName: "Some Unlisted Corner Shop",
      barcode: "ABC123",
      value: 25,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ retailerId: null, retailerName: "Some Unlisted Corner Shop" }),
    });
  });

  it("defaults currency to ZAR when not supplied", async () => {
    const create = vi.fn().mockResolvedValue({ id: "v1" });
    const prisma = {
      walletVoucher: { create },
      retailer: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;

    await createWalletVoucher(prisma, "user-1", {
      retailerName: "Shop",
      barcode: "X",
      value: 10,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ currency: "ZAR" }),
    });
  });
});

describe("listWalletVouchersForUser", () => {
  it("attaches the computed effectiveStatus to every voucher, without mutating the stored status", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "v1", status: "ACTIVE", expiresAt: new Date("2020-01-01") }, // really expired
      { id: "v2", status: "ACTIVE", expiresAt: null },
      { id: "v3", status: "REDEEMED", expiresAt: new Date("2099-01-01") },
    ]);
    const prisma = { walletVoucher: { findMany } } as any;

    const result = await listWalletVouchersForUser(prisma, "user-1");

    expect(result[0]!.status).toBe("ACTIVE"); // stored value untouched
    expect(result[0]!.effectiveStatus).toBe("EXPIRED"); // but reported correctly
    expect(result[1]!.effectiveStatus).toBe("ACTIVE");
    expect(result[2]!.effectiveStatus).toBe("REDEEMED");
  });

  it("scopes the query to the given user only", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { walletVoucher: { findMany } } as any;

    await listWalletVouchersForUser(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });
});

describe("getWalletVoucherForUser", () => {
  it("returns null (not an error) when the voucher doesn't exist or belongs to someone else", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { walletVoucher: { findFirst } } as any;

    const result = await getWalletVoucherForUser(prisma, "user-1", "voucher-1");

    expect(result).toBeNull();
    // Ownership check happens in the query itself, not after the fact.
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "voucher-1", userId: "user-1" } });
  });

  it("returns the voucher with effectiveStatus attached when found and owned", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "voucher-1", status: "ACTIVE", expiresAt: null });
    const prisma = { walletVoucher: { findFirst } } as any;

    const result = await getWalletVoucherForUser(prisma, "user-1", "voucher-1");

    expect(result!.effectiveStatus).toBe("ACTIVE");
  });
});

describe("redeemWalletVoucher", () => {
  it("marks an active voucher as redeemed", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "v1", status: "ACTIVE", expiresAt: null });
    const update = vi.fn().mockResolvedValue({ id: "v1", status: "REDEEMED" });
    const prisma = { walletVoucher: { findFirst, update } } as any;

    await redeemWalletVoucher(prisma, "user-1", "v1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({ status: "REDEEMED" }),
    });
  });

  it("refuses to redeem a voucher that doesn't exist or isn't owned by this user", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const prisma = { walletVoucher: { findFirst, update } } as any;

    await expect(redeemWalletVoucher(prisma, "user-1", "v1")).rejects.toThrow("WALLET_VOUCHER_NOT_FOUND");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to redeem a voucher that's already been redeemed", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "v1", status: "REDEEMED", expiresAt: null });
    const update = vi.fn();
    const prisma = { walletVoucher: { findFirst, update } } as any;

    await expect(redeemWalletVoucher(prisma, "user-1", "v1")).rejects.toThrow("WALLET_VOUCHER_ALREADY_REDEEMED");
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to redeem a voucher that's expired, even though its stored status is still ACTIVE", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "v1",
      status: "ACTIVE",
      expiresAt: new Date("2020-01-01"),
    });
    const update = vi.fn();
    const prisma = { walletVoucher: { findFirst, update } } as any;

    await expect(redeemWalletVoucher(prisma, "user-1", "v1")).rejects.toThrow("WALLET_VOUCHER_EXPIRED");
    expect(update).not.toHaveBeenCalled();
  });
});
