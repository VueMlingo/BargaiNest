/**
 * BN-031: extracts a normalized pack-size string (e.g. "2l", "6 x 1l",
 * "700g") from free text. Shared by two places that must agree on the
 * exact same normalized value for matching to work at all:
 *
 * 1. shopping-intent.service.ts -- parses what the USER typed
 *    ("Milk 2L") into attributes.packSize.
 * 2. retail-catalogue.normalizer.ts -- as a fallback for retailer
 *    adapters (Pick n Pay Hybris, Woolworths Constructor.io) that
 *    never populate a structured packSize field at all, only a raw
 *    product name ("Clover Fresh Milk 2L"). Without this fallback,
 *    retailer-offer.service.ts's pack-size matching -- an explicit
 *    hard constraint once the user's intent has a packSize -- rejects
 *    every single offer from these retailers whenever the user's
 *    shopping-list item specifies an explicit size, regardless of
 *    whether the actual product matches. This is the root cause
 *    behind BN-029's "Pick n Pay missing for some accounts" (accounts
 *    whose shopping-list items happen to include an explicit size)
 *    and is exactly the scenario BN-031 warns about ("incorrect
 *    product-size interpretation may cause a legitimate Pick n Pay
 *    offer to be rejected during matching").
 *
 * If this logic changes, both call sites change together --
 * duplicating it risks the two sides silently drifting out of sync
 * and reintroducing the exact mismatch this exists to prevent.
 */

function normalizeForPackSize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    // See shopping-intent.service.ts's own normalizeText for why this
    // runs before the symbol-stripping step below: × (distinct from
    // the letter "x") would otherwise be silently replaced with a
    // space, destroying multipack notation like "6×1L".
    .replace(/×/g, "x")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MULTIPACK_PATTERN = /\b(\d+)\s?x\s?(\d+(?:\.\d+)?)\s?(kg|g|l|ml)\b/i;
const SIMPLE_SIZE_PATTERN = /\b(\d+(?:\.\d+)?)\s?(kg|g|l|ml)\b/i;

export function extractPackSize(rawText: string): string | null {
  const normalizedText = normalizeForPackSize(rawText);

  const multipackMatch = normalizedText.match(MULTIPACK_PATTERN);
  if (multipackMatch) {
    const [, packCount, unitSize, unit] = multipackMatch;
    return normalizeForPackSize(`${packCount} x ${unitSize}${unit}`);
  }

  const simpleMatch = normalizedText.match(SIMPLE_SIZE_PATTERN);
  if (simpleMatch) {
    const [, amount, unit] = simpleMatch;
    // Reconstructed with no space between amount and unit,
    // deliberately -- "2 L" and "2L" describe the exact same size and
    // must normalize identically, not differ based on incidental
    // spacing in the original text.
    return `${amount}${unit}`;
  }

  return null;
}
