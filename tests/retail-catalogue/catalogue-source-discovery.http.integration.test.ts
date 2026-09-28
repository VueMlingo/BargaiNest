import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

const runDbTests = process.env.RUN_DB_TESTS === "1";

const describeDb = runDbTests ? describe : describe.skip;

describeDb("Catalogue source discovery authenticated HTTP integration", () => {
  let app: FastifyInstance;

  let userId: string | undefined;
  let sessionCookie: string | undefined;
  let createdSourceIds: string[] = [];

  const testEmail =
    `http-catalogue-discovery-${Date.now()}@example.invalid`;

  const testPassword =
    "PilotHTTPTest-2026!";

  beforeAll(async () => {
    const { buildApp } =
      await import("../../src/app/app.js");

    app = buildApp();

    await app.ready();

    console.log(
      "CATALOGUETEST: application ready"
    );
  }, 30_000);

  afterAll(async () => {
    console.log(
      "CATALOGUETEST: beginning cleanup"
    );

    if (createdSourceIds.length > 0) {
      await app.prisma.catalogueSource.deleteMany({
        where: {
          id: {
            in: createdSourceIds,
          },
        },
      });
    }

    if (userId) {
      await app.prisma.user.deleteMany({
        where: {
          id: userId,
        },
      });
    }

    await app.close();

    console.log(
      "CATALOGUETEST: cleanup complete"
    );
  }, 30_000);

  it("rejects unauthenticated source discovery", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/sources/discover",
      payload: {
        retailerCode: "SHOPRITE",
        countryCode: "ZA",
      },
    });

    console.log(
      "CATALOGUETEST: unauthenticated status =",
      response.statusCode
    );

    expect(response.statusCode).toBe(401);
  });

  it("registers a real user and receives the real session cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        password: testPassword,
      },
    });

    console.log(
      "CATALOGUETEST: registration status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(201);

    const body = response.json();

    expect(body.user).toBeTruthy();
    expect(body.user.id).toBeTruthy();
    expect(body.user.email).toBe(testEmail);

    userId = body.user.id;

    const setCookie = response.headers["set-cookie"];

    expect(setCookie).toBeTruthy();

    const cookies: string[] = Array.isArray(setCookie)
      ? setCookie.filter(
          (cookie): cookie is string =>
            typeof cookie === "string"
        )
      : typeof setCookie === "string"
        ? [setCookie]
        : [];

    const sessionSetCookie = cookies.find((cookie) =>
      cookie.startsWith("bn_session=")
    );

    expect(sessionSetCookie).toBeTruthy();

    sessionCookie =
      sessionSetCookie!.split(";")[0];

    expect(sessionCookie).toMatch(/^bn_session=.+/);

    console.log(
      "CATALOGUETEST: real bn_session received"
    );
  });

  it("rejects an invalid discovery request", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/sources/discover",
      headers: {
        cookie: sessionCookie!,
      },
      payload: {},
    });

    console.log(
      "CATALOGUETEST: invalid request status =",
      response.statusCode
    );

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("INVALID_REQUEST");
  });

  it("rejects a retailer without configured discovery", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/sources/discover",
      headers: {
        cookie: sessionCookie!,
      },
      payload: {
        retailerCode: "CLICKS",
        countryCode: "ZA",
      },
    });

    console.log(
      "CATALOGUETEST: unconfigured retailer status =",
      response.statusCode
    );

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe(
      "CATALOGUE_SOURCE_DISCOVERY_NOT_CONFIGURED"
    );
  });

  it("discovers and persists Shoprite catalogue sources", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/sources/discover",
      headers: {
        cookie: sessionCookie!,
      },
      payload: {
        retailerCode: "SHOPRITE",
        countryCode: "ZA",
      },
    });

    console.log(
      "CATALOGUETEST: Shoprite discovery status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(200);

    const body = response.json();

    expect(body.retailer).toBeTruthy();
    expect(body.retailer.code).toBe("SHOPRITE");
    expect(body.retailer.name).toBe("Shoprite");

    expect(body.discovered).toBeGreaterThan(0);
    expect(body.created).toBeGreaterThan(0);
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThan(0);

    createdSourceIds = body.sources
      .filter(
        (source: {
          id: string;
          created: boolean;
        }) => source.created
      )
      .map(
        (source: {
          id: string;
        }) => source.id
      );

    expect(createdSourceIds.length).toBeGreaterThan(0);

    const persisted =
      await app.prisma.catalogueSource.findMany({
        where: {
          id: {
            in: createdSourceIds,
          },
        },
      });

    expect(persisted.length).toBe(
      createdSourceIds.length
    );

    for (const source of persisted) {
      expect(source.retailerId).toBe(
        body.retailer.id
      );
      expect(source.code).toMatch(/^SHOPRITE_/);
      expect(source.sourceType).toBe("WEB_PAGE");
      expect(source.adapterKey).toBe(
        "SHOPRITE_PUBLICATION"
      );
      expect(source.countryCode).toBe("ZA");
      expect(source.active).toBe(true);
      expect(source.sourceUrl).toContain(
        "specials.shoprite.co.za"
      );
    }

    console.log(
      "CATALOGUETEST: persisted sources =",
      persisted.length
    );
  });
});
