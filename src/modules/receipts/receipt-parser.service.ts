/**
 * Parses raw OCR text (from ocr.service.ts) into structured line
 * items. Informed by an actual generated-receipt OCR run, not
 * guessed: real output collapses multiple spaces to one, drops purely
 * decorative separator lines, and cleanly separates an item name from
 * its trailing price by whitespace -- e.g.
 * "FULL CREAM MILK 1L 21.99". The approach here (last
 * whitespace-separated token is a price, everything before it is the
 * name) matches that shape directly.
 *
 * Real receipts vary far more than one generated sample -- different
 * retailers, fonts, layouts, thermal-printer fade, crumpling. This is
 * a reasonable starting parser tested against realistic (not just
 * idealized) sample text, not a guarantee it handles every real
 * receipt format. See BN-043-RECEIPT-PARSING.md for what still needs
 * validating against real photographed receipts.
 */

export interface ParsedReceiptLineItem {
  name: string;
  price: number;
}

export interface ParsedReceipt {
  retailerName: string | null;
  items: ParsedReceiptLineItem[];
  total: number | null;
}

/** Lines whose "name" portion is one of these are summary/payment
 *  lines, not purchased items -- excluded even though they match the
 *  same "text ending in a price" shape as a real item line. */
const NON_ITEM_KEYWORDS = new Set([
  "SUBTOTAL",
  "SUB TOTAL",
  "TOTAL",
  "VAT",
  "TAX",
  "CASH",
  "CHANGE",
  "TENDERED",
  "BALANCE",
  "CARD",
  "DEBIT",
  "CREDIT",
  "EFT",
  "AMOUNT DUE",
  "AMOUNT PAID",
  "DISCOUNT",
  "SAVINGS",
  "ROUNDING",
]);

/** A small, known set for now -- matches the retailers this project
 *  already has real, verified data for (BN-015). Extend alongside
 *  that verification work, not independently of it. */
const KNOWN_RETAILERS = ["SHOPRITE", "CHECKERS", "PICK N PAY", "WOOLWORTHS", "SPAR"];

/*
 * REG-005: optionally consumes a leading "R" (case-insensitive,
 * with or without a following space) as PART of the match, not just
 * the numeric price -- otherwise "Milk       R22.99" split the price
 * off correctly but left a stray "R" stuck on the item name
 * ("Milk       R"), and for the TOTAL line specifically, that stray
 * "R" broke the exact "TOTAL" string comparison used to detect it,
 * so a real total like "Total      R82.77" was silently dropped
 * (total stayed null) instead of being captured. Both bugs shared
 * this one root cause. R? and the following \s? are both optional,
 * so a bare, unprefixed price ("21.99") still matches exactly as
 * before -- this doesn't regress the already-confirmed working case.
 */
const PRICE_PATTERN = /R?\s?(-?\d+[.,]\d{2})\s*$/i;

function parsePrice(raw: string): number {
  return Number(raw.replace(",", "."));
}

function isNonItemLine(name: string): boolean {
  const normalized = name.trim().toUpperCase();
  for (const keyword of NON_ITEM_KEYWORDS) {
    if (normalized === keyword || normalized.startsWith(keyword + " ") || normalized.includes(keyword)) {
      return true;
    }
  }
  return false;
}

function findRetailerName(lines: string[]): string | null {
  // Only checks the first few lines -- a retailer name appearing deep
  // in a receipt (e.g. as part of a product name) shouldn't match.
  const headerLines = lines.slice(0, 3).join(" ").toUpperCase();
  for (const retailer of KNOWN_RETAILERS) {
    if (headerLines.includes(retailer)) {
      return retailer;
    }
  }
  return null;
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const retailerName = findRetailerName(lines);

  const items: ParsedReceiptLineItem[] = [];
  let total: number | null = null;

  for (const line of lines) {
    const match = line.match(PRICE_PATTERN);
    if (!match) continue;

    const price = parsePrice(match[1]!);
    if (!Number.isFinite(price) || price < 0) continue;

    const name = line.slice(0, match.index).trim();
    if (!name) continue;

    if (isNonItemLine(name)) {
      // TOTAL specifically is worth capturing separately, even though
      // it's excluded from the item list -- useful for sanity-checking
      // that parsed items roughly sum to it.
      if (name.trim().toUpperCase() === "TOTAL" && total === null) {
        total = price;
      }
      continue;
    }

    items.push({ name, price });
  }

  return { retailerName, items, total };
}
