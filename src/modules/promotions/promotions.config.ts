import { ShopriteSourceDiscoveryAdapter } from "../retail-catalogue/adapters/shoprite-source-discovery.adapter.js";
import { ShopritePublicationAdapter } from "../retail-catalogue/adapters/shoprite-publication.adapter.js";
import type { PromotionRetailerConfig } from "./promotions.service.js";

/**
 * Only Shoprite is wired here -- it's the one retailer with a
 * confirmed, real, working specials source (see
 * RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md). Checkers' specials
 * discovery adapter exists but is explicitly flagged unverified in
 * that same doc; wiring it into a user-facing promotions feed before
 * it's confirmed would risk showing unverified/wrong data as if it
 * were real. Add more retailers here once their specials sources are
 * confirmed the same way Shoprite's was.
 */
export const PROMOTION_RETAILER_CONFIGS: PromotionRetailerConfig[] = [
  {
    retailerCode: "SHOPRITE",
    retailerName: "Shoprite",
    retailerId: "SHOPRITE",
    discoveryAdapter: new ShopriteSourceDiscoveryAdapter(),
    publicationAdapterFactory: () => new ShopritePublicationAdapter(),
  },
];
