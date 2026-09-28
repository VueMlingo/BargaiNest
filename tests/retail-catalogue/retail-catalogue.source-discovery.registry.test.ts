import { describe, expect, it, vi } from "vitest";
import {
  CatalogueSourceDiscoveryRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.registry.js";

describe("CatalogueSourceDiscoveryRegistry", () => {
  it("resolves a registered discovery adapter", () => {
    const adapter = {
      discoveryKey: "test-discovery",
      discover: vi.fn(),
    };

    const registry = new CatalogueSourceDiscoveryRegistry({
      "test-discovery": () => adapter,
    });

    expect(registry.has("test-discovery")).toBe(true);
    expect(registry.resolve("test-discovery")).toBe(adapter);
  });

  it("rejects unknown discovery adapters", () => {
    const registry = new CatalogueSourceDiscoveryRegistry();

    expect(() => registry.resolve("missing")).toThrow(
      "CATALOGUE_SOURCE_DISCOVERY_NOT_FOUND:missing",
    );
  });

  it("rejects duplicate registration", () => {
    const registry = new CatalogueSourceDiscoveryRegistry();

    registry.register("test", () => ({
      discoveryKey: "test",
      discover: vi.fn(),
    }));

    expect(() =>
      registry.register("test", () => ({
        discoveryKey: "test",
        discover: vi.fn(),
      })),
    ).toThrow("CATALOGUE_SOURCE_DISCOVERY_ALREADY_REGISTERED:test");
  });

  it("rejects discovery key mismatches", () => {
    const registry = new CatalogueSourceDiscoveryRegistry();

    registry.register("expected", () => ({
      discoveryKey: "actual",
      discover: vi.fn(),
    }));

    expect(() => registry.resolve("expected")).toThrow(
      "CATALOGUE_SOURCE_DISCOVERY_KEY_MISMATCH:expected",
    );
  });
});
