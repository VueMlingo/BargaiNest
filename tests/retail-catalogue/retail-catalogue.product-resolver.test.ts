import { describe, expect, it, vi } from "vitest";

import { resolveCatalogueProduct } from "../../src/modules/retail-catalogue/retail-catalogue.product-resolver.js";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    externalId: null,
    retailerSku: null,
    gtin: null,
    barcode: null,
    rawName: "Full Cream Milk 2L",
    normalizedName: "full cream milk 2l",
    brand: null,
    packSize: "2L",
    unit: "2L",
    category: "Dairy",
    price: 38,
    wasPrice: null,
    currency: "ZAR",
    isPromotion: false,
    promotionText: null,
    validFrom: null,
    validUntil: null,
    sourceReference: "controlled-test",
    extractionMethod: "STRUCTURED",
    extractionConfidence: 1,
    rawData: null,
    ...overrides,
  } as any;
}

function makeApi(productFindMany: ReturnType<typeof vi.fn>) {
  return {
    prisma: {
      productIdentifier: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      productRetailer: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      product: {
        findMany: productFindMany,
      },
    },
  } as any;
}

describe("retail catalogue product resolver", () => {
  it("confirms an exact name match when exactly one active product exists", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk 2L",
          brand: "Test Brand",
          unit: "2L",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk 2L",
          brand: "Test Brand",
          unit: "2L",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem(),
    );

    expect(result.productId).toBe("product-001");
    expect(result.method).toBe("EXACT_NAME");
    expect(result.status).toBe("CONFIRMED");
    expect(result.confidence).toBe(0.95);
  });

  it("does not confirm an exact name when multiple active products have that name", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk 2L",
          brand: "Brand A",
          unit: "2L",
        },
        {
          id: "product-002",
          name: "Full Cream Milk 2L",
          brand: "Brand B",
          unit: "2L",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk 2L",
          brand: "Brand A",
          unit: "2L",
        },
        {
          id: "product-002",
          name: "Full Cream Milk 2L",
          brand: "Brand B",
          unit: "2L",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem(),
    );

    expect(result.method).not.toBe("EXACT_NAME");
    expect(result.status).not.toBe("CONFIRMED");
  });

  it("does not confirm a normalised-name match when multiple active products remain", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full-Cream Milk 2L",
          brand: "Brand A",
          unit: "2L",
        },
        {
          id: "product-002",
          name: "Full Cream Milk 2L",
          brand: "Brand B",
          unit: "2L",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem(),
    );

    expect(result.method).not.toBe("NORMALIZED_NAME");
    expect(result.status).not.toBe("CONFIRMED");
  });
});

describe("BN-015 product pack equivalence", () => {
  it("treats 1L and 1000ml as compatible pack sizes", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk",
          brand: "Test Brand",
          unit: "1000ml",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem({
        rawName: "Full Cream Milk",
        normalizedName: "full cream milk",
        packSize: "1L",
        unit: "1L",
        brand: "Test Brand",
      }),
    );

    expect(result.productId).toBe("product-001");
    expect(result.status).toBe("CONFIRMED");
  });

  it("does not treat 2L and 1L as compatible pack sizes", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk",
          brand: "Test Brand",
          unit: "1L",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem({
        rawName: "Full Cream Milk",
        normalizedName: "full cream milk",
        packSize: "2L",
        unit: "2L",
        brand: "Test Brand",
      }),
    );

    expect(result.productId).toBeNull();
    expect(result.status).not.toBe("CONFIRMED");
  });

  it("treats 6 x 330ml and 1980ml as compatible quantities", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Soft Drink",
          brand: "Test Brand",
          unit: "1980ml",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem({
        rawName: "Soft Drink",
        normalizedName: "soft drink",
        packSize: "6 x 330ml",
        unit: "6 x 330ml",
        brand: "Test Brand",
      }),
    );

    expect(result.productId).toBe("product-001");
    expect(result.status).toBe("CONFIRMED");
  });

  it("does not treat 500g and 1kg as compatible pack sizes", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Rice",
          brand: "Test Brand",
          unit: "1kg",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem({
        rawName: "Rice",
        normalizedName: "rice",
        packSize: "500g",
        unit: "500g",
        brand: "Test Brand",
      }),
    );

    expect(result.productId).toBeNull();
    expect(result.status).not.toBe("CONFIRMED");
  });

  it("does not auto-confirm the same product name when pack sizes differ", async () => {
    const productFindMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "product-001",
          name: "Full Cream Milk",
          brand: "Test Brand",
          unit: "1L",
        },
      ]);

    const result = await resolveCatalogueProduct(
      makeApi(productFindMany),
      "retailer-001",
      makeItem({
        rawName: "Full Cream Milk",
        normalizedName: "full cream milk",
        packSize: "2L",
        unit: "2L",
        brand: "Test Brand",
      }),
    );

    expect(result.productId).toBeNull();
    expect(result.status).not.toBe("CONFIRMED");
  });
});
