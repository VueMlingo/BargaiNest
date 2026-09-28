export type ShoppingIntentSpecificity =
  | "generic"
  | "specific";

export interface ShoppingIntentAttributes {
  category?: string;
  brand?: string;
  variant?: string;
  packSize?: string;
  unit?: string;
}

export interface ShoppingIntent {
  originalText: string;
  normalizedText: string;

  quantity: number;

  targetPrice?: number | null;

  specificity: ShoppingIntentSpecificity;

  attributes: ShoppingIntentAttributes;
}
