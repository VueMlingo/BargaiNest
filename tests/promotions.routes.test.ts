import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

vi.mock("../src/modules/promotions/promotions.config.js", () => ({
  PROMOTION_RETAILER_CONFIGS: [
    {
      retailerCode: "SHOPRITE",
      retailerName: "Shoprite",
      retailerId: "SHOPRITE",
      discoveryAdapter: {
        discover: async () => [{ code: "src-1", channel: "ONLINE_STORE", sourceType: "SPECIALS", sourceUrl: "https://shoprite.example/specials" }],
      },
      publicationAdapterFactory: () => ({
        discover: async () => [
          { name: "Shoprite Milk 2L", price: 25, currency: "ZAR", isPromotion: true, extractionMethod: "WEB_PARSER" },
        ],
      }),
    },
  ],
  buildLiveSearchPromotionConfigs: vi.fn(() => [
    {
      retailerCode: "PICK_N_PAY",
      retailerName: "Pick n Pay",
      adapter: {
        adapterKey: "PICK_N_PAY_LIVE_SEARCH",
        lookup: async (_ctx: any, query: { name?: string }) =>
          query.name === "Milk"
            ? [{ name: "PnP Full Cream Milk 2L", price: 24, currency: "ZAR", isPromotion: true, extractionMethod: "API" }]
            : [],
      },
      context: {},
    },
    {
      retailerCode: "WOOLWORTHS",
      retailerName: "Woolworths",
      adapter: {
        adapterKey: "WOOLWORTHS_LIVE_SEARCH",
        lookup: async () => {
          throw new Error("Constructor.io request failed");
        },
      },
      context: {},
    },
  ]),
}));

const { registerPromotionsRoutes } = await import("../src/modules/promotions/promotions.routes.js");

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
  app.decorate("prisma", {
    authSession: { findUnique: async () => makeValidSessionRow(), update: async () => ({}) },
  } as any);
  await app.register(cookie);
  await registerPromotionsRoutes(app);
  await app.ready();
  return app;
}

describe("BN-030: GET /promotions combines discovery and live-search retailers", () => {
  it("returns promotions from both the discovery path (Shoprite) and the live-search path (Pick n Pay)", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/promotions",
      headers: { authorization: "Bearer token" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const retailerCodes = body.promotions.map((p: any) => p.retailerCode);
    expect(retailerCodes).toContain("SHOPRITE");
    expect(retailerCodes).toContain("PICK_N_PAY");

    await app.close();
  });

  it("BN-030: one retailer's provider failing (Woolworths here) does not prevent the other retailers' results from being returned", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/promotions",
      headers: { authorization: "Bearer token" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const retailerCodes = body.promotions.map((p: any) => p.retailerCode);
    expect(retailerCodes).toContain("SHOPRITE");
    expect(retailerCodes).toContain("PICK_N_PAY");
    expect(retailerCodes).not.toContain("WOOLWORTHS");
    expect(body.sourcesFailed).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it("the retailer filter applies to the live-search path too, not just the discovery path", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/promotions?retailer=PICK_N_PAY",
      headers: { authorization: "Bearer token" },
    });

    const body = JSON.parse(response.body);
    expect(body.promotions.every((p: any) => p.retailerCode === "PICK_N_PAY")).toBe(true);
    expect(body.promotions.length).toBeGreaterThan(0);

    await app.close();
  });

  it("GET /promotions/retailers lists both discovery and live-search retailers", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/promotions/retailers",
      headers: { authorization: "Bearer token" },
    });

    const body = JSON.parse(response.body);
    const codes = body.map((r: any) => r.code);
    expect(codes).toContain("SHOPRITE");
    expect(codes).toContain("PICK_N_PAY");
    expect(codes).toContain("WOOLWORTHS");

    await app.close();
  });

  it("a search term (q) filters results from both paths consistently", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/promotions?q=milk",
      headers: { authorization: "Bearer token" },
    });

    const body = JSON.parse(response.body);
    expect(body.promotions.length).toBeGreaterThan(0);
    expect(body.promotions.every((p: any) => p.name.toLowerCase().includes("milk"))).toBe(true);

    await app.close();
  });
});
