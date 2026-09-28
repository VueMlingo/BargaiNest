import { describe, expect, it } from "vitest";

import {
  CatalogueAdapterRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.adapter-registry.js";

import type {
  CatalogueAdapter,
} from "../../src/modules/retail-catalogue/retail-catalogue.types.js";

function createAdapter(adapterKey: string): CatalogueAdapter {
  return {
    adapterKey,
    discover: async () => [],
  };
}

describe("CatalogueAdapterRegistry", () => {
  it("resolves a registered adapter", () => {
    const adapter = createAdapter("TEST_SOURCE");

    const registry = new CatalogueAdapterRegistry({
      TEST_SOURCE: () => adapter,
    });

    expect(registry.has("TEST_SOURCE")).toBe(true);
    expect(registry.resolve("TEST_SOURCE")).toBe(adapter);
  });

  it("fails clearly when an adapter is not registered", () => {
    const registry = new CatalogueAdapterRegistry();

    expect(() => registry.resolve("UNKNOWN_SOURCE")).toThrow(
      "CATALOGUE_ADAPTER_NOT_FOUND:UNKNOWN_SOURCE"
    );
  });

  it("rejects duplicate adapter registration", () => {
    const registry = new CatalogueAdapterRegistry();

    registry.register("TEST_SOURCE", () => createAdapter("TEST_SOURCE"));

    expect(() =>
      registry.register("TEST_SOURCE", () => createAdapter("TEST_SOURCE"))
    ).toThrow(
      "CATALOGUE_ADAPTER_ALREADY_REGISTERED:TEST_SOURCE"
    );
  });

  it("detects an adapter key mismatch", () => {
    const registry = new CatalogueAdapterRegistry({
      TEST_SOURCE: () => createAdapter("WRONG_SOURCE"),
    });

    expect(() => registry.resolve("TEST_SOURCE")).toThrow(
      "CATALOGUE_ADAPTER_KEY_MISMATCH:TEST_SOURCE"
    );
  });
});
