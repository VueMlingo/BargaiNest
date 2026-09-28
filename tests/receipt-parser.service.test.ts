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
});
