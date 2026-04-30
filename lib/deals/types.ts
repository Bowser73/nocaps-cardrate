import type { PricingCard } from "@/lib/pricing/types";

export type ActiveListing = {
  title: string;
  askingPriceCents: number;
  currency: string;
  listingUrl: string;
  source: string;
  imageUrl?: string | null;
  itemId?: string | null;
  shippingPriceCents?: number | null;
  listedAt?: string | null;
};

export type ActiveListingSearchResult = {
  listings: ActiveListing[];
  rawCount: number;
  sampleTitles: string[];
};

export type DealLabel = "Strong Deal" | "Possible Deal" | "Needs Research" | "Avoid";
export type FlipScoreLabel = "Strong Buy" | "Watch" | "Risky" | "Avoid";

export type UndervaluedFind = {
  player: string;
  sport: string;
  year: number | null;
  brandSet: string;
  cardNumber: string | null;
  currentAskingPriceCents: number;
  averageSoldPriceCents: number | null;
  estimatedUpsideCents: number | null;
  confidenceScore: number;
  marketplaceSource: string;
  listingUrl: string;
  listingTitle: string;
  dealLabel: DealLabel;
  flipScore: number;
  flipScoreLabel: FlipScoreLabel;
  activeListing: ActiveListing;
  soldCompCount: number;
};

export type DealSearchCard = PricingCard & {
  rookieFlag?: boolean;
};
