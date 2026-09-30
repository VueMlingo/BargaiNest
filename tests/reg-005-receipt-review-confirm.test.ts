import { describe, expect, it, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

vi.mock("../src/integrations/ocr/ocr.service.js", () => ({
  TesseractOcrService: vi.fn().mockImplementation(function () {
    return {
      recognizeText: vi.fn().mockResolvedValue(
        "SHOPRITE\nMilk       R22.99\nBread      R18.99\n\nSubtotal   R41.98\nTotal      R41.98",
      ),
      terminate: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock("../src/modules/promotions/promotions.service.js", () => ({
  browsePromotionsForRetailer: vi.fn().mockResolvedValue([]),
}));

const { registerReceiptRoutes } = await import("../src/modules/receipts/receipt.routes.js");

function makeValidSessionRow() {
  return {
    id: "session-1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: "user-1",
      status: "ACTIVE",
      identifiers: [{ value: "user@example.com", verified: true }],
      profile: { firstName: "Test", lastName: "User" },
    },
  };
}

async function buildTestApp() {
  const app = Fastify();
  const purchaseCreate = vi.fn().mockImplementation(({ data }: any) => ({
    id: "purchase-1",
    ...data,
    items: data.items.create,
  }));
  app.decorate("prisma", {
    authSession: {
      findUnique: async () => makeValidSessionRow(),
      update: async () => ({}),
    },
    purchase: {
      create: purchaseCreate,
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  } as any);
  await app.register(cookie);
  await registerReceiptRoutes(app);
  await app.ready();
  return { app, purchaseCreate };
}

describe("REG-005: receipt scan/review/confirm split", () => {
  it("scanning a receipt returns parsed data WITHOUT creating any purchase", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/me/receipts/scan",
      headers: { authorization: "Bearer token" },
      payload: { imageBase64: Buffer.from("fake image").toString("base64") },
    });

    expect(response.statusCode).toBe(200);
    expect(purchaseCreate).not.toHaveBeenCalled();

    const body = JSON.parse(response.body);
    expect(body.retailerName).toBe("SHOPRITE");
    expect(body.items).toEqual([
      { name: "Milk", price: 22.99, matchedPromotionName: null, paidPromoPrice: null },
      { name: "Bread", price: 18.99, matchedPromotionName: null, paidPromoPrice: null },
    ]);
    expect(body.total).toBe(41.98);

    await app.close();
  });

  it("confirming reviewed items via POST /purchases actually creates the purchase", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/me/purchases",
      headers: { authorization: "Bearer token" },
      payload: {
        retailerName: "SHOPRITE",
        totalAmount: 41.98,
        source: "RECEIPT_SCAN",
        items: [
          { name: "Milk", price: 22.99 },
          { name: "Bread", price: 18.99 },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
    const createArgs = purchaseCreate.mock.calls[0]![0];
    expect(createArgs.data.source).toBe("RECEIPT_SCAN");
    expect(createArgs.data.items.create).toHaveLength(2);

    await app.close();
  });

  it("the user's own review edits (a corrected name, a removed item, an added item) are exactly what gets persisted", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    await app.inject({
      method: "POST",
      url: "/me/purchases",
      headers: { authorization: "Bearer token" },
      payload: {
        retailerName: "SHOPRITE",
        items: [
          { name: "Full Cream Milk", price: 22.99 },
          { name: "Eggs (added manually)", price: 35.0 },
        ],
      },
    });

    const createArgs = purchaseCreate.mock.calls[0]![0];
    const persistedNames = createArgs.data.items.create.map((i: any) => i.name);
    expect(persistedNames).toEqual(["Full Cream Milk", "Eggs (added manually)"]);
    expect(persistedNames).not.toContain("Bread");

    await app.close();
  });

  it("promotion-match info carries through when confirming, for items the user didn't edit", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    await app.inject({
      method: "POST",
      url: "/me/purchases",
      headers: { authorization: "Bearer token" },
      payload: {
        items: [
          { name: "Milk", price: 22.99, matchedPromotionName: "2-for-1 Milk Special", paidPromoPrice: true },
        ],
      },
    });

    const createArgs = purchaseCreate.mock.calls[0]![0];
    expect(createArgs.data.items.create[0].matchedPromotionName).toBe("2-for-1 Milk Special");
    expect(createArgs.data.items.create[0].paidPromoPrice).toBe(true);

    await app.close();
  });

  it("REG-005: the receipt total is never insertable as a purchase line item -- confirming rejects an empty items array", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/me/purchases",
      headers: { authorization: "Bearer token" },
      payload: { items: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(purchaseCreate).not.toHaveBeenCalled();

    await app.close();
  });

  it("source defaults to MANUAL when not specified, preserving existing behaviour for plain manual entry", async () => {
    const { app, purchaseCreate } = await buildTestApp();

    await app.inject({
      method: "POST",
      url: "/me/purchases",
      headers: { authorization: "Bearer token" },
      payload: { items: [{ name: "Hand-typed item", price: 10 }] },
    });

    const createArgs = purchaseCreate.mock.calls[0]![0];
    expect(createArgs.data.source).toBe("MANUAL");

    await app.close();
  });

  it("a scan failure is handled gracefully -- returns a clear error, still doesn't persist anything", async () => {
    const app = Fastify();
    const purchaseCreate = vi.fn();
    app.decorate("prisma", {
      authSession: { findUnique: async () => makeValidSessionRow(), update: async () => ({}) },
      purchase: { create: purchaseCreate, findMany: vi.fn(), findFirst: vi.fn() },
    } as any);
    await app.register(cookie);

    const ocrModule = await import("../src/integrations/ocr/ocr.service.js");
    vi.mocked(ocrModule.TesseractOcrService).mockImplementationOnce(function () {
      return {
        recognizeText: vi.fn().mockRejectedValue(new Error("OCR blew up")),
        terminate: vi.fn().mockResolvedValue(undefined),
      };
    } as any);

    await registerReceiptRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/me/receipts/scan",
      headers: { authorization: "Bearer token" },
      payload: { imageBase64: Buffer.from("fake").toString("base64") },
    });

    expect(response.statusCode).toBe(500);
    expect(purchaseCreate).not.toHaveBeenCalled();

    await app.close();
  });
});
