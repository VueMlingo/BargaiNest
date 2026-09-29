/**
 * REG-004: parses raw OCR text (from the same ocr.service.ts already
 * used for receipt scanning -- no parallel OCR implementation here)
 * into structured voucher fields: retailer, value, valid-from date,
 * valid-until date, voucher number. Deliberately best-effort, the
 * same way receipt-parser.service.ts is: real vouchers vary widely in
 * layout, and this is a reasonable starting parser, not a guarantee
 * every field is found on every voucher. That's exactly why REG-004
 * requires a review/correct step before saving -- extraction quality
 * here directly determines what gets pre-filled for the user to
 * confirm or fix, never what gets silently persisted.
 *
 * Barcode extraction is NOT handled here at all -- that's the
 * existing BarcodeDetector-based camera scan already built for
 * loyalty cards and extended for vouchers (see app.js's
 * startBarcodeScan("voucher")). This module only concerns the OCR'd
 * *text* on a voucher (its printed value, dates, retailer name,
 * reference number), which the barcode scanner has no visibility
 * into at all.
 */

export interface ParsedVoucherFields {
  retailerName: string | null;
  value: number | null;
  voucherNumber: string | null;
  validFrom: string | null; // ISO date string (date-only), or null
  expiresAt: string | null; // ISO date string (date-only), or null
}

// Reuses the exact same known-retailer list already established in
// receipt-parser.service.ts, rather than inventing a second one.
const KNOWN_RETAILERS = ["SHOPRITE", "CHECKERS", "PICK N PAY", "WOOLWORTHS", "SPAR"];

function findRetailerName(text: string): string | null {
  const upper = text.toUpperCase();
  for (const retailer of KNOWN_RETAILERS) {
    if (upper.includes(retailer)) {
      return retailer;
    }
  }
  return null;
}

// Matches "R50", "R50.00", "R 50.00", optionally preceded by a label
// like VALUE/WORTH/AMOUNT -- the label, if present, is not required
// (many vouchers just print the amount on its own line).
const VALUE_PATTERN = /R\s?(\d+(?:[.,]\d{2})?)/i;

function findVoucherValue(text: string): number | null {
  const match = text.match(VALUE_PATTERN);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

// "VOUCHER NO: ABC123", "REF: XYZ-789", "CODE 12345" -- captures the
// alphanumeric token (with optional hyphens) right after the label.
const VOUCHER_NUMBER_PATTERN =
  /(?:voucher\s?(?:no|number)|ref(?:erence)?|code)\s*[:#]?\s*([A-Z0-9-]{4,})/i;

function findVoucherNumber(text: string): string | null {
  const match = text.match(VOUCHER_NUMBER_PATTERN);
  return match?.[1] ?? null;
}

// DD/MM/YYYY or DD-MM-YYYY -- the common South African date format.
// Deliberately not attempting "01 September 2026"-style dates or
// other locales/formats here; a reasonable starting parser, not a
// guarantee of every real voucher's layout (matching
// receipt-parser.service.ts's own stated scope).
const DATE_PATTERN = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;

function parseDateMatch(match: RegExpMatchArray): string | null {
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function findDatesLabeled(
  text: string,
  fromLabelPattern: RegExp,
  untilLabelPattern: RegExp,
): { validFrom: string | null; expiresAt: string | null } {
  let validFrom: string | null = null;
  let expiresAt: string | null = null;

  const fromMatch = text.match(fromLabelPattern);
  if (fromMatch) {
    const dateMatch = fromMatch[0].match(DATE_PATTERN);
    if (dateMatch) validFrom = parseDateMatch(dateMatch);
  }

  const untilMatch = text.match(untilLabelPattern);
  if (untilMatch) {
    const dateMatch = untilMatch[0].match(DATE_PATTERN);
    if (dateMatch) expiresAt = parseDateMatch(dateMatch);
  }

  if (validFrom === null && expiresAt === null) {
    const allDates = [...text.matchAll(new RegExp(DATE_PATTERN, "g"))]
      .map((m) => parseDateMatch(m))
      .filter((d): d is string => d !== null)
      .sort();

    if (allDates.length >= 2) {
      validFrom = allDates[0]!;
      expiresAt = allDates[allDates.length - 1]!;
    } else if (allDates.length === 1) {
      expiresAt = allDates[0]!;
    }
  }

  return { validFrom, expiresAt };
}

const FROM_LABEL_PATTERN = /(?:valid\s*from|from)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{4}/i;
const UNTIL_LABEL_PATTERN =
  /(?:valid\s*until|valid\s*to|expires?|expiry)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{4}/i;

export function parseVoucherText(rawText: string): ParsedVoucherFields {
  const retailerName = findRetailerName(rawText);
  const value = findVoucherValue(rawText);
  const voucherNumber = findVoucherNumber(rawText);
  const { validFrom, expiresAt } = findDatesLabeled(rawText, FROM_LABEL_PATTERN, UNTIL_LABEL_PATTERN);

  return { retailerName, value, voucherNumber, validFrom, expiresAt };
}
