import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "./auth.middleware.js";
import { discoverAndPersistCatalogueSources } from "../retail-catalogue/retail-catalogue.source-discovery.orchestrator.js";
import type { CatalogueAdapterRegistry } from "../retail-catalogue/retail-catalogue.adapter-registry.js";
import type { CatalogueSourceDiscoveryRegistry } from "../retail-catalogue/retail-catalogue.source-discovery.registry.js";

export interface CatalogueRouteDependencies {
  catalogueAdapterRegistry: CatalogueAdapterRegistry;
  catalogueSourceDiscoveryRegistry: CatalogueSourceDiscoveryRegistry;
}

const discoverCatalogueSourcesSchema = z.object({
  retailerCode: z.string().trim().min(1).max(50),
  countryCode: z.string().trim().min(2).max(2).optional(),
  province: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
});

export async function registerCatalogueRoutes(
  api: FastifyInstance,
  dependencies: CatalogueRouteDependencies,
) {
  api.post(
    "/catalog/sources/discover",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = discoverCatalogueSourcesSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
          message: "A valid retailerCode is required.",
          details: parsed.error.flatten(),
        });
      }

      const retailerCode = parsed.data.retailerCode.toUpperCase();

      const retailer = await api.prisma.retailer.findFirst({
        where: {
          code: retailerCode,
          status: "ACTIVE",
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      if (!retailer) {
        return reply.code(404).send({
          error: "RETAILER_NOT_FOUND",
          message: `Active retailer not found: ${retailerCode}`,
        });
      }

      const discoveryKey = retailer.code;

      if (!dependencies.catalogueSourceDiscoveryRegistry.has(discoveryKey)) {
        return reply.code(404).send({
          error: "CATALOGUE_SOURCE_DISCOVERY_NOT_CONFIGURED",
          message: `Catalogue source discovery is not configured for retailer: ${retailerCode}`,
        });
      }

      const result = await discoverAndPersistCatalogueSources(
        api.prisma,
        dependencies.catalogueSourceDiscoveryRegistry,
        {
          retailerId: retailer.id,
          retailerCode: retailer.code,
          retailerName: retailer.name,
          ...(parsed.data.countryCode !== undefined && {
            countryCode: parsed.data.countryCode,
          }),
          ...(parsed.data.province !== undefined && {
            province: parsed.data.province,
          }),
          ...(parsed.data.city !== undefined && {
            city: parsed.data.city,
          }),
          discoveryKey,
        },
      );

      return reply.send({
        retailer: {
          id: retailer.id,
          code: retailer.code,
          name: retailer.name,
        },
        ...result,
      });
    },
  );

  api.get("/catalog/loyalty-programmes", async (_request, reply) => {
    const programmes = await api.prisma.loyaltyProgram.findMany({
      where: {
        status: "ACTIVE",
        retailer: {
          status: "ACTIVE",
        },
      },
      orderBy: [
        {
          retailer: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        retailer: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            // Previously not selected at all — the frontend had no way
            // to know a live-sync integration existed for a retailer
            // until well after a card was already added.
            integrations: {
              where: { status: "ACTIVE" },
              select: { id: true, code: true },
              take: 1,
            },
          },
        },
      },
    });

    return reply.send(
      programmes.map((programme) => {
        const activeIntegration = programme.retailer.integrations[0];
        return {
          id: programme.id,
          name: programme.name,
          code: programme.code,
          retailer: {
            id: programme.retailer.id,
            name: programme.retailer.name,
            code: programme.retailer.code,
          },
          availableIntegration: activeIntegration
            ? { id: activeIntegration.id, code: activeIntegration.code }
            : null,
        };
      }),
    );
  });
}
