import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { GLOBAL_RATE_LIMIT, SENSITIVE_ROUTE_RATE_LIMITS } from "../src/config/rate-limit.config.js";

/**
 * Deliberately does NOT build the full app (app.ts pulls in Prisma at
 * module scope, which can't be constructed without a generated
 * client). Rate limiting itself has nothing to do with Prisma -- it
 * operates purely on Fastify's request/reply lifecycle -- so this
 * builds a minimal Fastify instance registering the exact same
 * plugin with the exact same shared config values production code
 * uses, then fires real requests via Fastify's built-in `.inject()`
 * (no real network needed) to confirm the actual plugin actually
 * enforces the actual configured limits. This is testing the real
 * @fastify/rate-limit behaviour, not a mock of it.
 */
async function buildTestApp() {
  const app = Fastify();
  await app.register(rateLimit, GLOBAL_RATE_LIMIT);

  app.get("/normal", async () => ({ ok: true }));

  app.post(
    "/sensitive-login-like",
    { config: { rateLimit: SENSITIVE_ROUTE_RATE_LIMITS.login } },
    async () => ({ ok: true }),
  );

  await app.ready();
  return app;
}

describe("rate limiting", () => {
  it("allows requests under the global limit through", async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/normal" });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("enforces the stricter per-route limit on a sensitive endpoint before the global one would kick in", async () => {
    const app = await buildTestApp();

    const loginLimit = SENSITIVE_ROUTE_RATE_LIMITS.login.max;
    expect(loginLimit).toBeLessThan(GLOBAL_RATE_LIMIT.max); // sanity check on the config itself

    let lastStatus = 200;
    for (let i = 0; i < loginLimit; i++) {
      const response = await app.inject({ method: "POST", url: "/sensitive-login-like" });
      lastStatus = response.statusCode;
    }
    expect(lastStatus).toBe(200); // exactly at the limit, still allowed

    const oneOver = await app.inject({ method: "POST", url: "/sensitive-login-like" });
    expect(oneOver.statusCode).toBe(429); // the next one is rejected

    await app.close();
  });

  it("returns a 429 with a clear error, not a silent failure or a 500", async () => {
    const app = await buildTestApp();
    const loginLimit = SENSITIVE_ROUTE_RATE_LIMITS.login.max;

    for (let i = 0; i < loginLimit; i++) {
      await app.inject({ method: "POST", url: "/sensitive-login-like" });
    }
    const response = await app.inject({ method: "POST", url: "/sensitive-login-like" });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("message");

    await app.close();
  });

  it("tracks the sensitive route's limit independently from the general/global limit", async () => {
    const app = await buildTestApp();
    const loginLimit = SENSITIVE_ROUTE_RATE_LIMITS.login.max;

    // Exhaust the sensitive route's limit.
    for (let i = 0; i < loginLimit; i++) {
      await app.inject({ method: "POST", url: "/sensitive-login-like" });
    }
    const sensitiveBlocked = await app.inject({ method: "POST", url: "/sensitive-login-like" });
    expect(sensitiveBlocked.statusCode).toBe(429);

    // The unrelated normal route should be completely unaffected --
    // its own (much higher) global limit hasn't been touched.
    const normalStillWorks = await app.inject({ method: "GET", url: "/normal" });
    expect(normalStillWorks.statusCode).toBe(200);

    await app.close();
  });

  it("configuration sanity: every sensitive route limit is stricter than the global default", () => {
    for (const [name, config] of Object.entries(SENSITIVE_ROUTE_RATE_LIMITS)) {
      expect(config.max, `${name} should be stricter than the global limit`).toBeLessThanOrEqual(
        GLOBAL_RATE_LIMIT.max,
      );
    }
  });
});
