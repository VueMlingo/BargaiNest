import type {
  CatalogueAdapter,
  CatalogueSourceContext,
  RawCatalogueItem,
} from "../retail-catalogue.types.js";

interface PilotProduct {
  name: string;
  brand: string;
  packSize: string;
  unit: string;
  category: string;
  prices: Record<string, number>;
}

const PILOT_PRODUCTS: PilotProduct[] = [
  {
    name: "Full Cream Milk 2L",
    brand: "Dairy",
    packSize: "2L",
    unit: "2L",
    category: "Dairy",
    prices: {
      SHOPRITE: 34.99,
      CHECKERS: 32.99,
      PICK_N_PAY: 33.99,
      WOOLWORTHS: 36.99,
    },
  },
  {
    name: "Brown Bread 700g",
    brand: "Albany",
    packSize: "700g",
    unit: "700g",
    category: "Bakery",
    prices: {
      SHOPRITE: 19.99,
      CHECKERS: 18.99,
      PICK_N_PAY: 19.49,
      WOOLWORTHS: 22.99,
    },
  },
  {
    name: "Coca-Cola 2L",
    brand: "Coca-Cola",
    packSize: "2L",
    unit: "2L",
    category: "Beverages",
    prices: {
      SHOPRITE: 24.99,
      CHECKERS: 23.99,
      PICK_N_PAY: 24.99,
      WOOLWORTHS: 26.99,
    },
  },
  {
    name: "Sunlight Dishwashing Liquid 750ml",
    brand: "Sunlight",
    packSize: "750ml",
    unit: "750ml",
    category: "Household",
    prices: {
      SHOPRITE: 29.99,
      CHECKERS: 27.99,
      PICK_N_PAY: 28.99,
      WOOLWORTHS: 32.99,
    },
  },
  {
    name: "White Sugar 2kg",
    brand: "Huletts",
    packSize: "2kg",
    unit: "2kg",
    category: "Pantry",
    prices: {
      SHOPRITE: 39.99,
      CHECKERS: 37.99,
      PICK_N_PAY: 38.99,
      WOOLWORTHS: 42.99,
    },
  },
  {
    name: "Long Life Milk 1L",
    brand: "Parmalat",
    packSize: "1L",
    unit: "1L",
    category: "Dairy",
    prices: {
      SHOPRITE: 17.99,
      CHECKERS: 16.99,
      PICK_N_PAY: 17.49,
      WOOLWORTHS: 19.99,
    },
  },
  {
    name: "Basmati Rice 2kg",
    brand: "Tastic",
    packSize: "2kg",
    unit: "2kg",
    category: "Pantry",
    prices: {
      SHOPRITE: 54.99,
      CHECKERS: 51.99,
      PICK_N_PAY: 53.99,
      WOOLWORTHS: 59.99,
    },
  },
  {
    name: "Sunflower Oil 2L",
    brand: "Sunfoil",
    packSize: "2L",
    unit: "2L",
    category: "Pantry",
    prices: {
      SHOPRITE: 49.99,
      CHECKERS: 47.99,
      PICK_N_PAY: 48.99,
      WOOLWORTHS: 54.99,
    },
  },
  {
    name: "Peanut Butter 400g",
    brand: "Black Cat",
    packSize: "400g",
    unit: "400g",
    category: "Pantry",
    prices: {
      SHOPRITE: 39.99,
      CHECKERS: 37.99,
      PICK_N_PAY: 38.99,
      WOOLWORTHS: 43.99,
    },
  },
  {
    name: "Corn Flakes 500g",
    brand: "Kellogg's",
    packSize: "500g",
    unit: "500g",
    category: "Breakfast",
    prices: {
      SHOPRITE: 44.99,
      CHECKERS: 41.99,
      PICK_N_PAY: 43.99,
      WOOLWORTHS: 48.99,
    },
  },
  {
    name: "Toilet Paper 18 Pack",
    brand: "Albany",
    packSize: "18 pack",
    unit: "18 pack",
    category: "Household",
    prices: {
      SHOPRITE: 89.99,
      CHECKERS: 84.99,
      PICK_N_PAY: 87.99,
      WOOLWORTHS: 94.99,
    },
  },
  {
    name: "Chicken Breasts 1kg",
    brand: "Farmer's Choice",
    packSize: "1kg",
    unit: "1kg",
    category: "Meat",
    prices: {
      SHOPRITE: 89.99,
      CHECKERS: 84.99,
      PICK_N_PAY: 87.99,
      WOOLWORTHS: 94.99,
    },
  },
];

export class PilotFixtureCatalogueAdapter
  implements CatalogueAdapter
{
  readonly adapterKey = "PILOT_FIXTURE";

  async discover(
    context: CatalogueSourceContext,
  ): Promise<RawCatalogueItem[]> {
    const retailerCode = context.storeCode ?? "";

    return PILOT_PRODUCTS
      .filter((product) => product.prices[retailerCode] !== undefined)
      .map((product) => ({
        externalId: `PILOT-${retailerCode}-${product.name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")}`,
        retailerSku: `PILOT-${retailerCode}-${product.name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")}`,
        name: product.name,
        brand: product.brand,
        packSize: product.packSize,
        unit: product.unit,
        category: product.category,
        price: product.prices[retailerCode]!,
        currency: "ZAR",
        isPromotion: false,
        validFrom: new Date(),
        validUntil: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ),
        sourceReference: `pilot://catalogue/${retailerCode}`,
        extractionMethod: "WEB_PARSER",
        extractionConfidence: 1,
        rawData: {
          source: "BargaiNest controlled pilot fixture",
          retailerCode,
          product: product.name,
        },
      }));
  }

}
