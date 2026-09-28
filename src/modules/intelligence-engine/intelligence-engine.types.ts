export interface PriceObservationProvenance {
  sourceReference?: string | null;
  catalogueItemId?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  confidence?: number | null;
  extractionMethod?: string | null;
  channel?: string | null;
  matchStatus?: "PROPOSED" | "CONFIRMED" | "REJECTED" | null;
}

export interface PriceComparisonAlternative {
  retailerId: string;
  retailerName?: string;
  price: number;
  currency: string;
  observedAt: Date;
  provenance?: PriceObservationProvenance;
}

export interface PriceComparisonInput {
  productId: string;
  productName: string;
  currentRetailerId: string;
  currentRetailerName?: string;
  currentPrice: number;
  currency: string;
  currentObservedAt: Date;
  currentProvenance?: PriceObservationProvenance;
  alternatives: PriceComparisonAlternative[];
}

export interface IntelligenceDecision {
  detected: boolean;
  type?: string;
  title?: string;
  description?: string;

  currentPrice?: number;
  alternativePrice?: number;
  estimatedSaving?: number;
  currency?: string;

  alternativeRetailerId?: string;
  alternativeRetailerName?: string;

  score?: number;
  confidence?: number;
  reason?: string;
}
