import type { ActiveListing } from "@/lib/deals/types";
import type { PriceGuideValue, SoldComp } from "@/lib/pricing/types";
import type { MarketplacePricingProvider, ProviderSearchInput } from "@/lib/providers/types";

class PlaceholderProvider implements MarketplacePricingProvider {
  constructor(
    public providerName: string,
    public supportsSoldComps: boolean,
    public supportsActiveListings: boolean,
    public supportsPriceGuide: boolean
  ) {}

  async searchSoldComps(_input: ProviderSearchInput): Promise<SoldComp[]> {
    return [];
  }

  async searchActiveListings(_input: ProviderSearchInput): Promise<ActiveListing[]> {
    return [];
  }

  async getPriceGuideValue(_input: ProviderSearchInput): Promise<PriceGuideValue | null> {
    return null;
  }
}

export const cardLadderProvider = new PlaceholderProvider("Card Ladder", true, false, true);
export const marketMoversProvider = new PlaceholderProvider("Market Movers", true, false, true);
export const fanaticsCollectProvider = new PlaceholderProvider("Fanatics Collect", true, true, false);
export const altProvider = new PlaceholderProvider("Alt", true, true, true);
