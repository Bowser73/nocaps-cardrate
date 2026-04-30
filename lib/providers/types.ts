import type { ActiveListing } from "@/lib/deals/types";
import type { PriceGuideValue, PricingCard, SoldComp } from "@/lib/pricing/types";

export type ProviderSearchInput = PricingCard & {
  query?: string;
  limit?: number;
};

export interface MarketplacePricingProvider {
  providerName: string;
  supportsSoldComps: boolean;
  supportsActiveListings: boolean;
  supportsPriceGuide: boolean;
  searchSoldComps(input: ProviderSearchInput): Promise<SoldComp[]>;
  searchActiveListings(input: ProviderSearchInput): Promise<ActiveListing[]>;
  getPriceGuideValue(input: ProviderSearchInput): Promise<PriceGuideValue | null>;
}
