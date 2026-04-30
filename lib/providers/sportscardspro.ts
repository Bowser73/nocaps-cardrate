import type { ActiveListing } from "@/lib/deals/types";
import type { PriceGuideValue, SoldComp } from "@/lib/pricing/types";
import { providerSourceLabels } from "@/lib/providers/labels";
import type { MarketplacePricingProvider, ProviderSearchInput } from "@/lib/providers/types";

const notConnectedMessage = "SportsCardsPro is not connected yet.";

export type SportsCardsProStatus<T> = {
  status: "NOT_CONNECTED" | "FOUND";
  message: string;
  data: T;
};

export type SportsCardsProGuideMatch = {
  providerName: "SportsCardsPro";
  title: string;
  setName: string | null;
  cardNumber: string | null;
  priceGuideValueCents: number | null;
  sourceUrl: string | null;
};

function isSportsCardsProConnected() {
  return process.env.SPORTSCARDSPRO_ENABLED === "true" && Boolean(process.env.SPORTSCARDSPRO_API_KEY);
}

function notConnected<T>(data: T): SportsCardsProStatus<T> {
  return {
    status: "NOT_CONNECTED",
    message: notConnectedMessage,
    data
  };
}

export async function searchCardPriceGuide(_input: ProviderSearchInput): Promise<SportsCardsProStatus<SportsCardsProGuideMatch[]>> {
  if (!isSportsCardsProConnected()) return notConnected([]);

  // TODO: Implement when SportsCardsPro API access and response contract are confirmed.
  return {
    status: "FOUND",
    message: "SportsCardsPro price guide integration is configured but not implemented yet.",
    data: []
  };
}

export async function getCardBySetAndNumber(_input: ProviderSearchInput): Promise<SportsCardsProStatus<SportsCardsProGuideMatch | null>> {
  if (!isSportsCardsProConnected()) return notConnected(null);

  // TODO: Implement when SportsCardsPro API access and response contract are confirmed.
  return {
    status: "FOUND",
    message: "SportsCardsPro set/card-number lookup is configured but not implemented yet.",
    data: null
  };
}

export async function getChecklistMatches(_input: ProviderSearchInput): Promise<SportsCardsProStatus<SportsCardsProGuideMatch[]>> {
  if (!isSportsCardsProConnected()) return notConnected([]);

  // TODO: Implement when SportsCardsPro API access and response contract are confirmed.
  return {
    status: "FOUND",
    message: "SportsCardsPro checklist integration is configured but not implemented yet.",
    data: []
  };
}

export class SportsCardsProProvider implements MarketplacePricingProvider {
  providerName = "SportsCardsPro";
  supportsSoldComps = false;
  supportsActiveListings = false;
  supportsPriceGuide = true;

  async searchSoldComps(_input: ProviderSearchInput): Promise<SoldComp[]> {
    return [];
  }

  async searchActiveListings(_input: ProviderSearchInput): Promise<ActiveListing[]> {
    return [];
  }

  async getPriceGuideValue(input: ProviderSearchInput): Promise<PriceGuideValue | null> {
    const result = await getCardBySetAndNumber(input);
    if (result.status === "NOT_CONNECTED" || !result.data) return null;

    return {
      providerName: providerSourceLabels.sportsCardsProPriceGuide,
      estimatedValueCents: result.data.priceGuideValueCents,
      confidenceScore: result.data.priceGuideValueCents == null ? 0 : 0.5,
      asOf: new Date().toISOString(),
      sourceUrl: result.data.sourceUrl
    };
  }
}
