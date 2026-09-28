import { describe, expect, it } from "vitest";
import { parseProductPage } from "../../src/modules/retail-catalogue/adapters/product-page.parser.js";

const JSON_LD_PAGE = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Checkers Housebrand Full Cream Milk 6 x 1L",
  "brand": { "name": "Checkers Housebrand" },
  "sku": "10156094PK1",
  "offers": { "price": 99.99, "priceCurrency": "ZAR" }
}
</script>
</head><body>...</body></html>
`;

const GRAPH_WRAPPED_PAGE = `
<html><head>
<script type="application/ld+json">
{ "@graph": [{ "@type": "Product", "name": "Dewfresh Milk 1L", "offers": { "price": 21.99 } }] }
</script>
</head><body>...</body></html>
`;

const NO_JSON_LD_PAGE = `<html><body><div>Dewfresh Full Cream Fresh Milk 1l</div><div>R21.99</div></body></html>`;

const NOTHING_TO_FIND_PAGE = `<html><body>No price anywhere on this page</body></html>`;

describe("parseProductPage (retailer-agnostic)", () => {
  it("extracts via JSON-LD when present", () => {
    const result = parseProductPage(JSON_LD_PAGE, "https://example.co.za/product/x");
    expect(result.extractionTier).toBe("JSON_LD");
    expect(result.item?.price).toBe(99.99);
    expect(result.item?.extractionMethod).toBe("STRUCTURED");
  });

  it("finds a Product node nested inside @graph", () => {
    const result = parseProductPage(GRAPH_WRAPPED_PAGE, "https://example.co.za/product/y");
    expect(result.extractionTier).toBe("JSON_LD");
    expect(result.item?.price).toBe(21.99);
  });

  it("falls back to low-confidence text extraction without JSON-LD", () => {
    const result = parseProductPage(NO_JSON_LD_PAGE, "https://example.co.za/product/z");
    expect(result.extractionTier).toBe("TEXT_FALLBACK");
    expect(result.item?.price).toBe(21.99);
    expect(result.item?.extractionConfidence).toBeLessThan(0.5);
  });

  it("returns NOT_FOUND rather than guessing when nothing matches", () => {
    const result = parseProductPage(NOTHING_TO_FIND_PAGE, "https://example.co.za/product/w");
    expect(result.extractionTier).toBe("NOT_FOUND");
    expect(result.item).toBeNull();
  });
});
