import { describe, expect, it } from "vitest";
import { parseVoucherText } from "../../src/modules/wallet-vouchers/voucher-ocr-parser.service.js";

describe("parseVoucherText", () => {
  it("extracts all fields from a clearly labeled, realistic voucher", () => {
    const text = [
      "WOOLWORTHS",
      "GIFT VOUCHER",
      "VALUE: R250.00",
      "VOUCHER NO: WW-2026-88421",
      "VALID FROM: 01/09/2026",
      "EXPIRES: 31/12/2026",
    ].join("\n");

    const result = parseVoucherText(text);

    expect(result.retailerName).toBe("WOOLWORTHS");
    expect(result.value).toBe(250);
    expect(result.voucherNumber).toBe("WW-2026-88421");
    expect(result.validFrom).toBe("2026-09-01");
    expect(result.expiresAt).toBe("2026-12-31");
  });

  it("extracts a bare value with no label at all", () => {
    const result = parseVoucherText("PICK N PAY VOUCHER\nR50.00\nRef: ABCD1234");
    expect(result.value).toBe(50);
    expect(result.retailerName).toBe("PICK N PAY");
    expect(result.voucherNumber).toBe("ABCD1234");
  });

  it("treats a single bare date as an expiry, not a valid-from date -- most vouchers are usable immediately", () => {
    const result = parseVoucherText("SHOPRITE R100 VOUCHER\nUse before 15/10/2026");
    expect(result.expiresAt).toBe("2026-10-15");
    expect(result.validFrom).toBeNull();
  });

  it("treats two unlabeled dates as valid-from (earlier) and expiry (later)", () => {
    const result = parseVoucherText("CHECKERS VOUCHER\n01/06/2026\n30/06/2026");
    expect(result.validFrom).toBe("2026-06-01");
    expect(result.expiresAt).toBe("2026-06-30");
  });

  it("a labeled expiry always wins over the unlabeled-date fallback, even if another bare date also appears", () => {
    const text = "SPAR VOUCHER\nIssued 01/01/2026\nExpires: 31/12/2026";
    const result = parseVoucherText(text);
    expect(result.expiresAt).toBe("2026-12-31");
  });

  it("returns null fields gracefully when nothing recognisable is present -- never throws", () => {
    const result = parseVoucherText("some illegible ocr garbage !!! @@@");
    expect(result.retailerName).toBeNull();
    expect(result.value).toBeNull();
    expect(result.voucherNumber).toBeNull();
    expect(result.validFrom).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it("does not crash or misparse on a genuinely invalid date (month 13)", () => {
    const result = parseVoucherText("Expires: 15/13/2026");
    expect(result.expiresAt).toBeNull();
  });

  it("handles a comma as the decimal separator (a common OCR/regional variant of R50,00)", () => {
    const result = parseVoucherText("Value R50,00");
    expect(result.value).toBe(50);
  });

  it("recognises 'REF' as well as 'VOUCHER NO' for the reference number", () => {
    const result = parseVoucherText("Woolworths Voucher\nREF: XY-9988");
    expect(result.voucherNumber).toBe("XY-9988");
  });

  it("is case-insensitive for both retailer name and field labels", () => {
    const result = parseVoucherText("woolworths gift card\nvalue: r75.00\nvoucher number: aa1122");
    expect(result.retailerName).toBe("WOOLWORTHS");
    expect(result.value).toBe(75);
    expect(result.voucherNumber?.toUpperCase()).toBe("AA1122");
  });

  it("empty string input returns all-null fields, not an error", () => {
    const result = parseVoucherText("");
    expect(result).toEqual({
      retailerName: null,
      value: null,
      voucherNumber: null,
      validFrom: null,
      expiresAt: null,
    });
  });
});
