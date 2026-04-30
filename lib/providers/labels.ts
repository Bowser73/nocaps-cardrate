export const providerSourceLabels = {
  ebaySoldComps: "eBay Sold Comps",
  ebayActiveListings: "eBay Active Listings",
  sportsCardsProPriceGuide: "SportsCardsPro Price Guide",
  cardLadderHistoricalSales: "Card Ladder Historical Sales",
  fanaticsCollectAuctions: "Fanatics Collect Auctions"
} as const;

export type ProviderSourceLabel = typeof providerSourceLabels[keyof typeof providerSourceLabels];
