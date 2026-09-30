import { describe, expect, it } from "vitest";
import { createShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.service.js";

describe("REG-003: product specification vs quantity -- multipack notation", () => {
  it("REG-003's own exact example: '6 x 1L Clover Milk' retains the full '6 x 1L' pack spec, not just '1L'", () => {
    const intent = createShoppingIntent({ text: "6 x 1L Clover Milk" });
    expect(intent.attributes.packSize).toBeTruthy();
    expect(intent.attributes.packSize).toContain("6");
    expect(intent.attributes.packSize).toContain("1l");
    expect(intent.attributes.packSize).not.toBe("1l");
  });

  it("multipack notation is recognised regardless of the multiplier symbol used (x, X, ×) and spacing", () => {
    const variants = ["6 x 1L", "6x1L", "6 X 1L", "6×1L", "6 × 1L"];
    for (const variant of variants) {
      const intent = createShoppingIntent({ text: variant + " Clover Milk" });
      expect(intent.attributes.packSize, `failed for variant: "${variant}"`).toContain("6");
      expect(intent.attributes.packSize, `failed for variant: "${variant}"`).toContain("1l");
    }
  });

  it("a genuinely single-unit size (no multipack prefix) still works exactly as before -- this fix doesn't regress the simple case", () => {
    const intent = createShoppingIntent({ text: "Milk 2L" });
    expect(intent.attributes.packSize).toBe("2l");
  });

  it("different multipack counts and unit sizes are captured distinctly -- '6 x 1L' and '12 x 500ml' don't collapse to the same thing", () => {
    const sixPack = createShoppingIntent({ text: "6 x 1L Clover Milk" });
    const twelvePack = createShoppingIntent({ text: "12 x 500ml Clover Milk" });

    expect(sixPack.attributes.packSize).not.toBe(twelvePack.attributes.packSize);
  });

  it("REG-003's other explicit acceptance case: quantity is never derived from the multipack text -- it's a wholly separate concept the parser doesn't touch", () => {
    const intent = createShoppingIntent({ text: "6 x 1L Clover Milk" });
    expect(intent.quantity).toBe(1);
  });

  it("a multipack with a decimal unit size (e.g. '4 x 1.5L') is captured correctly", () => {
    const intent = createShoppingIntent({ text: "4 x 1.5L Cooldrink" });
    expect(intent.attributes.packSize).toContain("4");
    expect(intent.attributes.packSize).toContain("1.5l");
  });

  it("weight-based multipacks (e.g. '6 x 100g') work the same way as volume", () => {
    const intent = createShoppingIntent({ text: "6 x 100g Yoghurt" });
    expect(intent.attributes.packSize).toContain("6");
    expect(intent.attributes.packSize).toContain("100g");
  });
});
