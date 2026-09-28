/**
 * Central rate-limit values, shared between the global registration
 * (app.ts) and the stricter per-route overrides below. Kept in one
 * place rather than duplicated magic numbers scattered across route
 * files, and reused directly by the test suite so the test asserts
 * against the real configured values, not a guessed copy of them.
 */

export const GLOBAL_RATE_LIMIT = {
  max: 100,
  timeWindow: "1 minute",
} as const;

/**
 * Stricter than the global default for endpoints where abuse has a
 * real cost beyond generic API load: brute-forcing a password, mass
 * account creation, email-bombing via password reset, or spamming the
 * support inbox (which sends a real email per submission).
 */
export const SENSITIVE_ROUTE_RATE_LIMITS = {
  login: { max: 10, timeWindow: "15 minutes" },
  register: { max: 5, timeWindow: "1 hour" },
  passwordResetRequest: { max: 5, timeWindow: "1 hour" },
  supportRequest: { max: 10, timeWindow: "1 hour" },
} as const;
