import { describe, expect, it } from "vitest";
import { extractPackSize } from "../../src/modules/shopping-intent/pack-size.util.js";

describe("extractPackSize", () => {
  it("extracts a simple size", () => {
    expect(extractPackSize("Milk 2L")).toBe("2l");
    expect(extractPackSize("FULL CREAM MILK 1L")).toBe("1l");
  });

  it("extracts multipack notation, retaining the multiplier", () => {
    expect(extractPackSize("6 x 1L Clover Milk")).toBe("6 x 1l");
    expect(extractPackSize("Clover Fresh Milk 6x1L")).toBe("6 x 1l");
  });

  it("handles the × (multiplication sign) the same as the letter x", () => {
    expect(extractPackSize("6×1L")).toBe("6 x 1l");
    expect(extractPackSize("6 × 1L")).toBe("6 x 1l");
  });

  it("returns null when there is no recognisable size in the text", () => {
    expect(extractPackSize("Some product with no size")).toBeNull();
  });

  it("BN-031/BN-029: produces the exact same normalized value for the user's request text and a retailer's raw product name, when they describe the same size", () => {
    const userRequestedText = "Milk 2L";
    const retailerProductName = "Clover Fresh Full Cream Milk 2L";
    expect(extractPackSize(userRequestedText)).toBe(extractPackSize(retailerProductName));
  });

  it("is case and spacing insensitive, consistent with shopping-intent.service.ts's own normalization", () => {
    expect(extractPackSize("milk 2l")).toBe(extractPackSize("MILK 2L"));
    expect(extractPackSize("Coke 2 L")).toBe(extractPackSize("Coke 2L"));
  });

  it("extracts weight-based sizes the same way as volume", () => {
    expect(extractPackSize("Sugar 2kg")).toBe("2kg");
    expect(extractPackSize("Butter 500g")).toBe("500g");
  });

  it("correctly distinguishes different sizes -- 1L and 300ml never collapse to the same value", () => {
    expect(extractPackSize("Coke 2L")).not.toBe(extractPackSize("Coke 300ml"));
  });
});
