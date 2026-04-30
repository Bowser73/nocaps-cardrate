import { EbayMarketplaceProvider } from "@/lib/providers/ebay";
import {
  altProvider,
  cardLadderProvider,
  fanaticsCollectProvider,
  marketMoversProvider
} from "@/lib/providers/placeholders";
import { SportsCardsProProvider } from "@/lib/providers/sportscardspro";
export { providerSourceLabels } from "@/lib/providers/labels";
export type { ProviderSourceLabel } from "@/lib/providers/labels";

const sportsCardsProProvider = new SportsCardsProProvider();

export const marketplaceProviders = [
  new EbayMarketplaceProvider(),
  sportsCardsProProvider,
  cardLadderProvider,
  marketMoversProvider,
  fanaticsCollectProvider,
  altProvider
];

export const enabledMarketplaceProviders = marketplaceProviders.filter((provider) =>
  provider.providerName === "eBay" ||
  (provider.providerName === "SportsCardsPro" && process.env.SPORTSCARDSPRO_ENABLED === "true" && Boolean(process.env.SPORTSCARDSPRO_API_KEY))
);
