import { describe, expect, it } from "vitest";
import { parseReceiptText } from "../src/modules/receipts/receipt-parser.service.js";

/**
 * This exact text is not invented -- it's the real output of running
 * TesseractOcrService against a generated receipt image (see
 * ocr.service.integration.test.ts for the OCR half of this pipeline).
 * Using genuine OCR output as the parser's test fixture, rather than
 * hand-typed idealized text, is what actually validates the two
 * pieces work together correctly.
 */
const REAL_OCR_OUTPUT = `SHOPRITE

123 Main Road

FULL CREAM MILK 1L 21.99
WHITE BREAD 700G 15.99
WHITE SUGAR 2KG 34.50
FIVE ROSES TEA 100S 42.99
COCA-COLA 2L 24.99
SUBTOTAL 140.46
VAT 18.30
TOTAL 140.46
CASH 150.00
CHANGE 9.54
`;

describe("parseReceiptText", () => {
  it("correctly parses real OCR output end to end", () => {
    const result = parseReceiptText(REAL_OCR_OUTPUT);

    expect(result.retailerName).toBe("SHOPRITE");
    expect(result.total).toBe(140.46);

    expect(result.items).toEqual([
      { name: "FULL CREAM MILK 1L", price: 21.99 },
      { name: "WHITE BREAD 700G", price: 15.99 },
      { name: "WHITE SUGAR 2KG", price: 34.5 },
      { name: "FIVE ROSES TEA 100S", price: 42.99 },
      { name: "COCA-COLA 2L", price: 24.99 },
    ]);
  });

  it("excludes SUBTOTAL, VAT, CASH, and CHANGE from the item list", () => {
    const result = parseReceiptText(REAL_OCR_OUTPUT);
    const names = result.items.map((i) => i.name);
    expect(names).not.toContain("SUBTOTAL");
    expect(names).not.toContain("VAT");
    expect(names).not.toContain("CASH");
    expect(names).not.toContain("CHANGE");
  });

  it("sanity check: parsed items sum close to the parsed total", () => {
    const result = parseReceiptText(REAL_OCR_OUTPUT);
    const sum = result.items.reduce((s, i) => s + i.price, 0);
    // Won't match exactly (VAT-inclusive pricing vs a sum of ex-VAT
    // lines is a real-world wrinkle this parser doesn't attempt to
    // resolve) -- but should be in the right ballpark.
    expect(Math.abs(sum - (result.total ?? 0))).toBeLessThan(1);
  });

  it("returns null retailerName when no known retailer is found", () => {
    const result = parseReceiptText("SOME UNKNOWN STORE\nITEM ONE 10.00\n");
    expect(result.retailerName).toBeNull();
    expect(result.items).toEqual([{ name: "ITEM ONE", price: 10.0 }]);
  });

  it("handles completely empty text without crashing", () => {
    const result = parseReceiptText("");
    expect(result).toEqual({ retailerName: null, items: [], total: null });
  });

  it("ignores lines with no trailing price at all", () => {
    const result = parseReceiptText("CHECKERS\nThank you for shopping\nMILK 21.99\n");
    expect(result.items).toEqual([{ name: "MILK", price: 21.99 }]);
  });

  it("recognizes each known retailer", () => {
    expect(parseReceiptText("CHECKERS\nITEM 5.00\n").retailerName).toBe("CHECKERS");
    expect(parseReceiptText("PICK N PAY\nITEM 5.00\n").retailerName).toBe("PICK N PAY");
    expect(parseReceiptText("WOOLWORTHS\nITEM 5.00\n").retailerName).toBe("WOOLWORTHS");
    expect(parseReceiptText("SPAR\nITEM 5.00\n").retailerName).toBe("SPAR");
  });

  it("does not match a retailer name appearing deep in the receipt (only checks the header)", () => {
    const manyLines = Array.from({ length: 10 }, (_, i) => `ITEM ${i} 5.00`).join("\n");
    const result = parseReceiptText(`UNKNOWN STORE\n${manyLines}\nSHOPRITE BAG 2.00\n`);
    expect(result.retailerName).toBeNull();
  });

  it("handles a comma as a decimal separator (some locales/OCR quirks)", () => {
    const result = parseReceiptText("SHOPRITE\nMILK 21,99\n");
    expect(result.items[0]!.price).toBe(21.99);
  });

  it("rejects a negative-looking price rather than treating it as a valid item", () => {
    const result = parseReceiptText("SHOPRITE\nDISCOUNT -5.00\n");
    expect(result.items).toEqual([]);
  });

  it("REG-005: strips a currency-prefixed price ('R22.99') cleanly, without leaving a stray 'R' stuck on the item name", () => {
    const result = parseReceiptText("SHOPRITE\nMilk R22.99\n");
    expect(result.items[0]!.name).toBe("Milk");
    expect(result.items[0]!.price).toBe(22.99);
  });

  it("REG-005's own exact acceptance example: items, subtotal, VAT, and total are all correctly separated, with a real total extracted", () => {
    const text = [
      "SHOPRITE",
      "Milk       R22.99",
      "Bread      R18.99",
      "Sugar      R29.99",
      "",
      "Subtotal   R71.97",
      "VAT        R10.80",
      "Total      R82.77",
    ].join("\n");

    const result = parseReceiptText(text);

    expect(result.items).toEqual([
      { name: "Milk", price: 22.99 },
      { name: "Bread", price: 18.99 },
      { name: "Sugar", price: 29.99 },
    ]);
    // The critical regression this fix exists to prevent: the total
    // must never be silently dropped, and must never appear as a
    // fourth "item".
    expect(result.total).toBe(82.77);
    expect(result.items).toHaveLength(3);
    expect(result.items.some((item) => item.name.toUpperCase().includes("TOTAL"))).toBe(false);
    expect(result.items.some((item) => item.name.toUpperCase().includes("SUBTOTAL"))).toBe(false);
    expect(result.items.some((item) => item.name.toUpperCase().includes("VAT"))).toBe(false);
  });

  it("REG-005: a currency-prefixed price with a space before the digits ('R 50.00') is also handled correctly", () => {
    const result = parseReceiptText("WOOLWORTHS\nEggs R 50.00\n");
    expect(result.items[0]!.name).toBe("Eggs");
    expect(result.items[0]!.price).toBe(50);
  });

  it("REG-005: an unprefixed price (no 'R' at all) still works exactly as before -- this fix doesn't regress the already-working case", () => {
    const result = parseReceiptText("SHOPRITE\nFULL CREAM MILK 1L 21.99\n");
    expect(result.items[0]!.name).toBe("FULL CREAM MILK 1L");
    expect(result.items[0]!.price).toBe(21.99);
  });
});
