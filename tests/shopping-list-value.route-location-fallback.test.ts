import Fastify from "fastify";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  registerShoppingListValueRoutes,
} from "../src/modules/shopping-list-value/shopping-list-value.routes.js";

import { evaluateShoppingListValue } from "../src/modules/shopping-list-value/shopping-list-value.service.js";

vi.mock(
  "../src/modules/shopping-list-value/shopping-list-value.service.js",
  () => ({
    evaluateShoppingListValue: vi.fn(),
  }),
);

vi.mock(
  "../src/modules/auth/auth.middleware.js",
  () => ({
    requireAuth: vi.fn(async (request: any) => {
      request.currentUserId = "user-001";
    }),
  }),
);

const mockedEvaluateShoppingListValue =
  vi.mocked(evaluateShoppingListValue);

function makePrisma(profile: any) {
  return {
    userProfile: {
      findUnique: vi.fn().mockResolvedValue(profile),
    },
  };
}

const registry = {} as any;

describe("shopping-list-value route location fallback", () => {
  beforeEach(() => {
    mockedEvaluateShoppingListValue.mockReset();
    mockedEvaluateShoppingListValue.mockResolvedValue({
      items: [],
      summary: {},
    } as any);
  });

  it("uses saved profile location when query parameters are absent", async () => {
    const profile = {
      province: "Western Cape",
      latitude: -34.05,
      longitude: 18.47,
      pnpStoreCode: "WC34",
    };

    const prisma = makePrisma(profile);
    const app = Fastify();

    await registerShoppingListValueRoutes(
      Object.assign(app, { prisma }),
      {
        cataloguePriceLookupRegistry: registry,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/me/shopping-lists/list-001/value",
    });

    expect(response.statusCode).toBe(200);

    expect(
      prisma.userProfile.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        userId: "user-001",
      },
      select: {
        province: true,
        latitude: true,
        longitude: true,
        pnpStoreCode: true,
      },
    });

    expect(
      mockedEvaluateShoppingListValue,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockedEvaluateShoppingListValue.mock.calls[0]!;

    expect(call[1]).toBe("user-001");
    expect(call[2]).toBe("list-001");

    expect(call[4]).toMatchObject({
      province: "Western Cape",
      storeCode: "WC34",
      latitude: -34.05,
      longitude: 18.47,
    });

    await app.close();
  });

  it("lets explicit query parameters override saved profile values", async () => {
    const profile = {
      province: "Gauteng",
      latitude: -26.20,
      longitude: 28.04,
      pnpStoreCode: "GA01",
    };

    const prisma = makePrisma(profile);
    const app = Fastify();

    await registerShoppingListValueRoutes(
      Object.assign(app, { prisma }),
      {
        cataloguePriceLookupRegistry: registry,
      },
    );

    const response = await app.inject({
      method: "GET",
      url:
        "/me/shopping-lists/list-001/value" +
        "?province=Western%20Cape&pnpStoreCode=WC34",
    });

    expect(response.statusCode).toBe(200);

    expect(
      mockedEvaluateShoppingListValue,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockedEvaluateShoppingListValue.mock.calls[0]!;

    expect(call[4]).toMatchObject({
      province: "Western Cape",
      storeCode: "WC34",
    });

    await app.close();
  });

  it("does not query the profile when both location query values are explicit", async () => {
    const prisma = makePrisma({
      province: "Gauteng",
      latitude: -26.20,
      longitude: 28.04,
      pnpStoreCode: "GA01",
    });

    const app = Fastify();

    await registerShoppingListValueRoutes(
      Object.assign(app, { prisma }),
      {
        cataloguePriceLookupRegistry: registry,
      },
    );

    const response = await app.inject({
      method: "GET",
      url:
        "/me/shopping-lists/list-001/value" +
        "?province=Western%20Cape&pnpStoreCode=WC34",
    });

    expect(response.statusCode).toBe(200);

    expect(
      prisma.userProfile.findUnique,
    ).not.toHaveBeenCalled();

    expect(
      mockedEvaluateShoppingListValue,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockedEvaluateShoppingListValue.mock.calls[0]!;

    expect(call[4]).toMatchObject({
      province: "Western Cape",
      storeCode: "WC34",
    });

    await app.close();
  });
});
