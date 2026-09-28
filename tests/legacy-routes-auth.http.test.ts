import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

/*
 * These route files import real Prisma enum VALUES at runtime (e.g.
 * `RetailerStatus.ACTIVE`), not just types -- so simply typechecking
 * isn't enough to prove they load and execute correctly, and this
 * sandbox has no generated Prisma client to import for real. Mocking
 * the enum values (their actual shape: plain string-keyed objects) is
 * enough to let the real route files load and run genuinely, rather
 * than settling for "the code looks right."
 */
vi.mock("@prisma/client", () => ({
  RetailerStatus: { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" },
  LoyaltyProgramStatus: { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" },
  ProductStatus: { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE", DISCONTINUED: "DISCONTINUED" },
  ProductIdentifierType: { BARCODE: "BARCODE", SKU: "SKU", GTIN: "GTIN" },
}));

const { registerRetailerRoutes } = await import("../src/modules/retailers/retailer.routes.js");
const { registerLoyaltyProgramRoutes } = await import(
  "../src/modules/loyalty-programs/loyalty-program.routes.js"
);
const { registerProductRoutes } = await import("../src/modules/products/product.routes.js");
const { registerPriceObservationRoutes } = await import(
  "../src/modules/price-observations/price-observation.routes.js"
);

/**
 * BN-011: proves requireAuth is actually enforced on the four route
 * modules that previously had none at all -- not just that the code
 * compiles with an import added. Builds a real, minimal Fastify
 * instance (sidestepping the Prisma-generation sandbox limitation
 * behind every other skipped test here, same approach already used in
 * rate-limit.test.ts) with a fake prisma decorated on, and fires real
 * requests through real route handlers via Fastify's `.inject()`.
 *
 * A fake session row is enough to exercise the real getUserFromSession
 * logic inside requireAuth (hash lookup, revoked/expired/active
 * checks) end to end -- this is testing the real auth gate, not a
 * mock of it.
 */

function makeFakePrisma(overrides: Record<string, unknown> = {}) {
  return {
    authSession: {
      findUnique: async () => null,
      update: async () => ({}),
    },
    ...overrides,
  } as any;
}

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

async function buildTestApp(registerFn: (api: any) => Promise<void>, prisma: any) {
  const app = Fastify();
  app.decorate("prisma", prisma);
  await app.register(cookie);
  await registerFn(app);
  await app.ready();
  return app;
}

describe("BN-011: legacy routes now require authentication", () => {
  const cases: [string, (api: any) => Promise<void>, string][] = [
    ["retailer routes", registerRetailerRoutes, "/retailers"],
    ["loyalty-program routes", registerLoyaltyProgramRoutes, "/loyalty-programs"],
    ["product routes", registerProductRoutes, "/products"],
    ["price-observation routes", registerPriceObservationRoutes, "/price-observations"],
  ];

  for (const [label, registerFn, path] of cases) {
    it(`${label}: an anonymous request with no session at all is rejected with 401`, async () => {
      const app = await buildTestApp(registerFn, makeFakePrisma());

      const response = await app.inject({ method: "GET", url: path });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("UNAUTHENTICATED");

      await app.close();
    });

    it(`${label}: a request with an invalid/unknown session token is rejected with 401`, async () => {
      const app = await buildTestApp(registerFn, makeFakePrisma());

      const response = await app.inject({
        method: "GET",
        url: path,
        headers: { authorization: "Bearer not-a-real-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("INVALID_SESSION");

      await app.close();
    });

    it(`${label}: a request with a valid session is let through to the real handler (not blocked by the auth gate)`, async () => {
      const modelKey =
        path === "/retailers"
          ? "retailer"
          : path === "/loyalty-programs"
            ? "loyaltyProgram"
            : path === "/products"
              ? "product"
              : "priceObservation";

      const app = await buildTestApp(
        registerFn,
        makeFakePrisma({
          authSession: {
            findUnique: async () => makeValidSessionRow(),
            update: async () => ({}),
          },
          [modelKey]: {
            findMany: async () => [],
          },
        }),
      );

      const response = await app.inject({
        method: "GET",
        url: path,
        headers: { authorization: "Bearer some-valid-looking-token" },
      });

      // The point here is NOT 401 from the auth gate -- 200 with an
      // empty list proves the request reached the real handler.
      expect(response.statusCode).toBe(200);

      await app.close();
    });
  }

  it("a revoked session is rejected the same as no session at all", async () => {
    const app = await buildTestApp(
      registerRetailerRoutes,
      makeFakePrisma({
        authSession: {
          findUnique: async () => ({ ...makeValidSessionRow(), revokedAt: new Date() }),
          update: async () => ({}),
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/retailers",
      headers: { authorization: "Bearer revoked-token" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("an expired session is rejected the same as no session at all", async () => {
    const app = await buildTestApp(
      registerRetailerRoutes,
      makeFakePrisma({
        authSession: {
          findUnique: async () => ({
            ...makeValidSessionRow(),
            expiresAt: new Date(Date.now() - 1000),
          }),
          update: async () => ({}),
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/retailers",
      headers: { authorization: "Bearer expired-token" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("write operations (POST) are gated too, not just reads -- this was the most severe part of the original gap", async () => {
    const app = await buildTestApp(registerRetailerRoutes, makeFakePrisma());

    const response = await app.inject({
      method: "POST",
      url: "/retailers",
      payload: { name: "Malicious Retailer", code: "HACKED" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
