import { describe, expect, it } from "vitest";

import {
  CataloguePriceLookupRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.registry.js";

import type {
  CataloguePriceLookupAdapter,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.types.js";

function createAdapter(
  adapterKey: string
): CataloguePriceLookupAdapter {
  return {
    adapterKey,

    async lookup() {
      return [];
    },
  };
}

describe("CataloguePriceLookupRegistry", () => {
  it("registers and resolves a lookup adapter", () => {
    const adapter = createAdapter("TEST_LOOKUP");

    const registry =
      new CataloguePriceLookupRegistry();

    registry.register(
      "TEST_LOOKUP",
      () => adapter
    );

    expect(
      registry.has("TEST_LOOKUP")
    ).toBe(true);

    expect(
      registry.resolve("TEST_LOOKUP")
    ).toBe(adapter);
  });

  it("rejects a blank adapter key", () => {
    const registry =
      new CataloguePriceLookupRegistry();

    expect(() =>
      registry.register(
        "   ",
        () => createAdapter("TEST_LOOKUP")
      )
    ).toThrow(
      "CATALOGUE_PRICE_LOOKUP_ADAPTER_KEY_MISSING"
    );
  });

  it("rejects duplicate adapter keys", () => {
    const registry =
      new CataloguePriceLookupRegistry();

    registry.register(
      "TEST_LOOKUP",
      () => createAdapter("TEST_LOOKUP")
    );

    expect(() =>
      registry.register(
        "TEST_LOOKUP",
        () => createAdapter("TEST_LOOKUP")
      )
    ).toThrow(
      "CATALOGUE_PRICE_LOOKUP_ADAPTER_ALREADY_REGISTERED:TEST_LOOKUP"
    );
  });

  it("rejects resolving an unknown adapter", () => {
    const registry =
      new CataloguePriceLookupRegistry();

    expect(() =>
      registry.resolve("UNKNOWN_LOOKUP")
    ).toThrow(
      "CATALOGUE_PRICE_LOOKUP_ADAPTER_NOT_FOUND:UNKNOWN_LOOKUP"
    );
  });

  it("rejects a factory that returns no adapter", () => {
    const registry =
      new CataloguePriceLookupRegistry();

    registry.register(
      "BROKEN_LOOKUP",
      () => undefined as unknown as CataloguePriceLookupAdapter
    );

    expect(() =>
      registry.resolve("BROKEN_LOOKUP")
    ).toThrow(
      "CATALOGUE_PRICE_LOOKUP_ADAPTER_FACTORY_FAILED:BROKEN_LOOKUP"
    );
  });

  it("rejects an adapter whose key does not match the registry key", () => {
    const registry =
      new CataloguePriceLookupRegistry();

    registry.register(
      "EXPECTED_LOOKUP",
      () => createAdapter("DIFFERENT_LOOKUP")
    );

    expect(() =>
      registry.resolve("EXPECTED_LOOKUP")
    ).toThrow(
      "CATALOGUE_PRICE_LOOKUP_ADAPTER_KEY_MISMATCH:EXPECTED_LOOKUP"
    );
  });

  it("trims adapter keys when checking and resolving", () => {
    const adapter = createAdapter("TEST_LOOKUP");

    const registry =
      new CataloguePriceLookupRegistry();

    registry.register(
      "  TEST_LOOKUP  ",
      () => adapter
    );

    expect(
      registry.has("TEST_LOOKUP")
    ).toBe(true);

    expect(
      registry.resolve("  TEST_LOOKUP  ")
    ).toBe(adapter);
  });

  it("supports constructor factories", () => {
    const adapter = createAdapter("CONSTRUCTOR_LOOKUP");

    const registry =
      new CataloguePriceLookupRegistry({
        CONSTRUCTOR_LOOKUP: () => adapter,
      });

    expect(
      registry.resolve("CONSTRUCTOR_LOOKUP")
    ).toBe(adapter);
  });
});
