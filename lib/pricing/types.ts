import type { Sport } from "@prisma/client";

export type PricingCard = {
  sport: Sport;
  playerName: string;
  year?: number | null;
  brand?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  parallel?: string | null;
  serialNumber?: string | null;
  rookieFlag?: boolean | null;
};

export type SoldComp = {
  title: string;
  salePriceCents: number;
  currency: string;
  soldAt: string | null;
  source: string;
  listingUrl?: string | null;
  condition?: string | null;
  gradeCompany?: string | null;
  gradeValue?: string | null;
  isDemo?: boolean;
  saleType?: "RAW" | "GRADED" | "UNKNOWN";
  relevanceScore?: number;
  matchNotes?: string[];
};

export type PriceGuideValue = {
  providerName: string;
  estimatedValueCents: number | null;
  lowValueCents?: number | null;
  highValueCents?: number | null;
  confidenceScore: number;
  asOf: string | null;
  sourceUrl?: string | null;
};

export type ValueInsights = {
  estimatedRawValueCents: number | null;
  potentialGradedValueCents: number | null;
  gradingSpreadCents: number | null;
  worthGrading: "YES" | "MAYBE" | "NO" | "UNKNOWN";
  rationale: string;
};

export type PricingDebug = {
  exactQuery: string;
  broaderQuery?: string;
  rawSoldCompsReturned: number;
  compsRemovedByFilters: number;
  usableComps: number;
  removedCompReasons: Array<{ title: string; reason: string }>;
  confidenceScore: number;
  confidenceExplanation: string;
  activeListingsUsedOnlyAsMarketSentiment: boolean;
};

export type PriceEstimate = {
  status: "FOUND" | "NO_COMPS" | "NOT_CONNECTED";
  message?: string;
  lowEstimateCents: number | null;
  averageEstimateCents: number | null;
  highEstimateCents: number | null;
  confidenceScore: number;
  comps: SoldComp[];
  valueInsights: ValueInsights;
  debug?: PricingDebug;
};

export interface PricingProvider {
  name: string;
  getSoldComps(card: PricingCard): Promise<SoldComp[]>;
}
