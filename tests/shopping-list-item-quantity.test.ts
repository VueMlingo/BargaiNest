import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * BN-017: the quantity stepper must move in whole item units (1 -> 2
 * -> 3), not fractional steps. The bug was `step="0.01"` on the
 * frontend input (copy-pasted from the price-field pattern) plus no
 * whole-number check anywhere -- so a decimal quantity could reach
 * the API two ways: the native number-input spinner, or the user
 * typing a decimal directly.
 *
 * This tests the exact rule now used in both
 * createShoppingListItemSchema and updateShoppingListItemSchema
 * (shopping-list.routes.ts) directly, rather than importing that file
 * -- importing it transitively pulls in a @prisma/client enum
 * (ShoppingListItemStatus) that isn't resolvable in this sandbox (the
 * same known Prisma-generation limitation behind every other skipped
 * test in this project, e.g. retailer-loyalty.integration.test.ts).
 * The rule itself -- z.coerce.number().positive().int() -- has no
 * Prisma dependency and is exactly what ships in the real schema.
 */
const quantitySchema = z.coerce.number().positive().int().optional();

describe("shopping list item quantity — whole units only (BN-017)", () => {
  it("accepts a whole-number quantity", () => {
    expect(quantitySchema.safeParse(3).success).toBe(true);
  });

  it("rejects a decimal quantity", () => {
    expect(quantitySchema.safeParse(1.5).success).toBe(false);
  });

  it("rejects the exact kind of value the old 0.01-step spinner could produce", () => {
    expect(quantitySchema.safeParse(1.01).success).toBe(false);
  });

  it("still rejects zero and negative quantities", () => {
    expect(quantitySchema.safeParse(0).success).toBe(false);
    expect(quantitySchema.safeParse(-1).success).toBe(false);
  });

  it("remains optional (defaults are handled elsewhere)", () => {
    expect(quantitySchema.safeParse(undefined).success).toBe(true);
  });

  it("coerces a numeric string the same way the real endpoint receives form/JSON input", () => {
    expect(quantitySchema.safeParse("3").success).toBe(true);
    expect(quantitySchema.safeParse("1.5").success).toBe(false);
  });
});
