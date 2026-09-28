export interface ShoppingBrandVocabularyEntry {
  canonical: string;
  aliases: readonly string[];
}

export const SHOPPING_BRAND_VOCABULARY: readonly ShoppingBrandVocabularyEntry[] = [
  {
    canonical: "coca-cola",
    aliases: [
      "coca cola",
      "coca-cola",
      "coke",
    ],
  },
  {
    canonical: "pepsi",
    aliases: [
      "pepsi",
    ],
  },
  {
    canonical: "nestle",
    aliases: [
      "nestle",
    ],
  },
];
