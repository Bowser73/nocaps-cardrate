import { buildCardQuery } from "@/lib/card-normalize";
import { dollarsToCents } from "@/lib/money";
import { providerSourceLabels } from "@/lib/providers/labels";
import type { DealSearchCard, ActiveListing, ActiveListingSearchResult } from "@/lib/deals/types";

type EbayTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type EbayBrowseItem = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  image?: { imageUrl?: string };
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
  itemCreationDate?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function hasEbayBrowseCredentials() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function getEbayAccessToken() {
  if (!hasEbayBrowseCredentials()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  if (!response.ok) return null;
  const data = (await response.json()) as EbayTokenResponse;
  if (!data.access_token) return null;

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000
  };
  return cachedToken.token;
}

function buildActiveSearchQuery(card: DealSearchCard) {
  return buildCardQuery(card)
    .replace(/\bNeeds review\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getEbayActiveListings(card: DealSearchCard): Promise<ActiveListing[]> {
  return searchEbayActiveListings(buildActiveSearchQuery(card), 10);
}

export async function searchEbayActiveListings(query: string, limit = 24): Promise<ActiveListing[]> {
  const result = await searchEbayActiveListingsWithDebug(query, limit);
  return result.listings;
}

export async function searchEbayActiveListingsWithDebug(query: string, limit = 24): Promise<ActiveListingSearchResult> {
  const token = await getEbayAccessToken();
  if (!token) return { listings: [], rawCount: 0, sampleTitles: [] };

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: "price",
    filter: "buyingOptions:{FIXED_PRICE|AUCTION},conditions:{1000|1500|1750|2000|2500|2750|3000|4000|5000|6000}"
  });

  const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      "User-Agent": "NoCapsCardRate/0.1"
    },
    next: { revalidate: 600 }
  });

  if (!response.ok) return { listings: [], rawCount: 0, sampleTitles: [] };
  const data = (await response.json()) as { itemSummaries?: EbayBrowseItem[] };
  const rawItems = data.itemSummaries ?? [];
  const sampleTitles = rawItems.slice(0, 3).map((item) => item.title ?? "Untitled eBay listing");
  console.log("[Market Gallery] raw eBay active listing count", { query, rawCount: rawItems.length });
  console.log("[Market Gallery] first raw eBay active listing titles", sampleTitles);

  const listings = rawItems
    .map((item) => ({
      title: item.title ?? "Active card listing",
      askingPriceCents: dollarsToCents(Number(item.price?.value ?? 0)),
      currency: item.price?.currency ?? "USD",
      listingUrl: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? "",
      source: providerSourceLabels.ebayActiveListings,
      imageUrl: item.image?.imageUrl ?? null,
      itemId: item.itemId ?? null,
      shippingPriceCents: item.shippingOptions?.[0]?.shippingCost?.value
        ? dollarsToCents(Number(item.shippingOptions[0].shippingCost?.value ?? 0))
        : null,
      listedAt: item.itemCreationDate ?? null
    }))
    .filter((item) => item.askingPriceCents > 0 && item.listingUrl);
  return { listings, rawCount: rawItems.length, sampleTitles };
}

export function isDealFinderConnected() {
  return hasEbayBrowseCredentials();
}
