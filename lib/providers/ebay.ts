import { getEbayActiveListings, searchEbayActiveListings } from "@/lib/deals/ebay-active";
import { EbaySoldPricingProvider } from "@/lib/pricing/ebay";
import type { ActiveListing } from "@/lib/deals/types";
import type { PriceGuideValue, SoldComp } from "@/lib/pricing/types";
import type { MarketplacePricingProvider, ProviderSearchInput } from "@/lib/providers/types";

const ebaySoldProvider = new EbaySoldPricingProvider();

export class EbayMarketplaceProvider implements MarketplacePricingProvider {
  providerName = "eBay";
  supportsSoldComps = true;
  supportsActiveListings = true;
  supportsPriceGuide = false;

  async searchSoldComps(input: ProviderSearchInput): Promise<SoldComp[]> {
    return ebaySoldProvider.getSoldComps(input);
  }

  async searchActiveListings(input: ProviderSearchInput): Promise<ActiveListing[]> {
    if (input.query) return searchEbayActiveListings(input.query, input.limit ?? 24);
    return getEbayActiveListings({ ...input, rookieFlag: Boolean(input.rookieFlag) });
  }

  async getPriceGuideValue(): Promise<PriceGuideValue | null> {
    return null;
  }
}
