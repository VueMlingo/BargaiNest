import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseShopritePublication } from "../../src/modules/retail-catalogue/adapters/shoprite-publication.parser.js";

describe("Shoprite publication parser", () => {
  it("parses the real Shoprite publication HTML fixture", () => {
    const fixturePath = resolve(
      process.cwd(),
      "tests/retail-catalogue/fixtures/shoprite-redbull.html"
    );

    const html = readFileSync(fixturePath, "utf8");

    const sourceReference =
      "https://specials.shoprite.co.za/deals/gnredbullenergydrinksavings28aug13sep2026/index.html";

    const result = parseShopritePublication(html, sourceReference);

    expect(result.title).toContain(
      "Shoprite Red Bull Energy Drink Savings Gauteng"
    );

    expect(result.validFrom?.toISOString()).toContain("2026-08-28");
    expect(result.validUntil?.toISOString()).toContain("2026-09-13");

    expect(result.region).toContain("GAUTENG");
    expect(result.countryCode).toBe("ZA");

    expect(result.items.length).toBeGreaterThanOrEqual(1);

    const redBull = result.items.find((item) =>
      item.name.toLowerCase().includes("red bull")
    );

    expect(redBull).toBeDefined();
    expect(redBull?.price).toBe(19.99);
    expect(redBull?.currency).toBe("ZAR");
    expect(redBull?.sourceReference).toBe(sourceReference);
    expect(redBull?.extractionMethod).toBe("WEB_PARSER");
    expect(redBull?.extractionConfidence).toBeGreaterThanOrEqual(0.8);
    expect(redBull?.isPromotion).toBe(true);
  });
});
