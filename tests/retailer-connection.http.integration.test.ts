import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

const runDbTests = process.env.RUN_DB_TESTS === "1";

const describeDb = runDbTests ? describe : describe.skip;

describeDb("Retailer connection authenticated HTTP integration", () => {
  let app: FastifyInstance;

  let userId: string | undefined;
  let loyaltyAccountId: string | undefined;
  let connectionId: string | undefined;
  let snapshotId: string | undefined;
  let sessionCookie: string | undefined;

  const loyaltyProgramId =
    "5381c32b-f990-491b-a1b8-92b507e596f8";

  const integrationId =
    "63eb818f-a9f2-11f1-b2b5-42010a400002";

  const testEmail =
    `http-retailer-${Date.now()}@example.invalid`;

  const testPassword =
    "PilotHTTPTest-2026!";

  beforeAll(async () => {
    const { buildApp } =
      await import("../src/app/app.js");

    app = buildApp();

    await app.ready();

    console.log("HTTPTEST: application ready");
  }, 30_000);

  afterAll(async () => {
    console.log("HTTPTEST: beginning cleanup");

    if (snapshotId) {
      await app.prisma.loyaltySnapshot.deleteMany({
        where: {
          id: snapshotId
        }
      });
    }

    if (connectionId) {
      await app.prisma.retailerConnection.deleteMany({
        where: {
          id: connectionId
        }
      });
    }

    if (loyaltyAccountId) {
      await app.prisma.loyaltyAccount.deleteMany({
        where: {
          id: loyaltyAccountId
        }
      });
    }

    if (userId) {
      await app.prisma.user.deleteMany({
        where: {
          id: userId
        }
      });
    }

    await app.close();

    console.log("HTTPTEST: cleanup complete");
  }, 30_000);

  it("rejects unauthenticated retailer connection access", async () => {
    const response = await app.inject({
      method: "GET",
      url:
        "/api/v1/me/loyalty-accounts/" +
        "00000000-0000-0000-0000-000000000000" +
        "/connection"
    });

    console.log(
      "HTTPTEST: unauthenticated status =",
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
        password: testPassword
      }
    });

    console.log(
      "HTTPTEST: registration status =",
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

    console.log("HTTPTEST: real bn_session received");
  });

  it("validates the real session through /auth/me", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: sessionCookie!
      }
    });

    console.log(
      "HTTPTEST: /auth/me status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(200);

    const body = response.json();

    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(testEmail);
  });

  it("creates the loyalty account through the authenticated API", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/me/loyalty-accounts",
      headers: {
        cookie: sessionCookie!
      },
      payload: {
        loyaltyProgramId
      }
    });

    console.log(
      "HTTPTEST: loyalty account status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(201);

    const body = response.json();

    expect(body.id).toBeTruthy();
    expect(body.userId).toBe(userId);
    expect(body.loyaltyProgramId).toBe(
      loyaltyProgramId
    );

    expect(Number(body.pointsBalance)).toBe(0);

    loyaltyAccountId = body.id;

    expect(loyaltyAccountId).toBeTruthy();
  });

  it("creates the retailer connection through the authenticated API", async () => {
    expect(sessionCookie).toBeTruthy();
    expect(loyaltyAccountId).toBeTruthy();

    const accountId = loyaltyAccountId!;

    const externalAccountId =
      `MOCK-HTTP-${Date.now()}`;

    const response = await app.inject({
      method: "POST",
      url:
        `/api/v1/me/loyalty-accounts/` +
        `${accountId}/connection`,
      headers: {
        cookie: sessionCookie!
      },
      payload: {
        integrationId,
        externalAccountId
      }
    });

    console.log(
      "HTTPTEST: connection creation status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(201);

    const body = response.json();

    expect(body.id).toBeTruthy();
    expect(body.loyaltyAccountId).toBe(
      accountId
    );
    expect(body.integrationId).toBe(
      integrationId
    );
    expect(body.externalAccountId).toBe(
      externalAccountId
    );
    expect(body.status).toBe("ACTIVE");

    connectionId = body.id;

    expect(connectionId).toBeTruthy();
  });

  it("retrieves the retailer connection with retailer information", async () => {
    expect(sessionCookie).toBeTruthy();
    expect(loyaltyAccountId).toBeTruthy();

    const accountId = loyaltyAccountId!;

    const response = await app.inject({
      method: "GET",
      url:
        `/api/v1/me/loyalty-accounts/` +
        `${accountId}/connection`,
      headers: {
        cookie: sessionCookie!
      }
    });

    console.log(
      "HTTPTEST: connection retrieval status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(200);

    const body = response.json();

    expect(body.id).toBe(connectionId);
    expect(body.loyaltyAccountId).toBe(
      accountId
    );

    expect(body.integration).toBeTruthy();
    expect(body.integration.code).toBe(
      "SHOPRITE_XTRA_SAVINGS"
    );

    expect(body.integration.retailer).toBeTruthy();
    expect(body.integration.retailer.name).toBe(
      "Shoprite"
    );
  });

  it("syncs retailer state through the authenticated API", async () => {
    expect(sessionCookie).toBeTruthy();
    expect(loyaltyAccountId).toBeTruthy();

    const accountId = loyaltyAccountId!;

    const response = await app.inject({
      method: "POST",
      url:
        `/api/v1/me/loyalty-accounts/` +
        `${accountId}/sync`,
      headers: {
        cookie: sessionCookie!
      }
    });

    console.log(
      "HTTPTEST: sync status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(200);

    const body = response.json();

    expect(body.loyaltyAccountId).toBe(
      accountId
    );

    expect(body.retailerConnectionId).toBe(
      connectionId
    );

    expect(body.integrationCode).toBe(
      "SHOPRITE_XTRA_SAVINGS"
    );

    expect(body.providerCode).toBe(
      "MOCK_RETAILER"
    );

    expect(Number(body.balance)).toBe(2450);

    expect(body.snapshotId).toBeTruthy();

    snapshotId = body.snapshotId;

    expect(snapshotId).toBeTruthy();
  });

  it("retrieves the latest retailer snapshot", async () => {
    expect(sessionCookie).toBeTruthy();
    expect(loyaltyAccountId).toBeTruthy();

    const accountId = loyaltyAccountId!;

    const response = await app.inject({
      method: "GET",
      url:
        `/api/v1/me/loyalty-accounts/` +
        `${accountId}/snapshot`,
      headers: {
        cookie: sessionCookie!
      }
    });

    console.log(
      "HTTPTEST: snapshot retrieval status =",
      response.statusCode
    );

    expect(
      response.statusCode,
      response.body
    ).toBe(200);

    const body = response.json();

    expect(body.id).toBe(snapshotId);
    expect(body.loyaltyAccountId).toBe(
      accountId
    );

    expect(Number(body.balance)).toBe(2450);
    expect(body.source).toBe("MOCK_RETAILER");
  });

  it("does not overwrite loyaltyAccount.pointsBalance", async () => {
    expect(loyaltyAccountId).toBeTruthy();

    const accountId = loyaltyAccountId!;

    const account =
      await app.prisma.loyaltyAccount.findUnique({
        where: {
          id: accountId
        }
      });

    expect(account).not.toBeNull();

    expect(
      Number(account?.pointsBalance)
    ).toBe(0);
  });

  it("rejects access to a non-owned loyalty account", async () => {
    expect(sessionCookie).toBeTruthy();

    const response = await app.inject({
      method: "GET",
      url:
        "/api/v1/me/loyalty-accounts/" +
        "00000000-0000-0000-0000-000000000000" +
        "/connection",
      headers: {
        cookie: sessionCookie!
      }
    });

    console.log(
      "HTTPTEST: non-owned account status =",
      response.statusCode
    );

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe(
      "LOYALTY_ACCOUNT_NOT_FOUND"
    );
  });
});
