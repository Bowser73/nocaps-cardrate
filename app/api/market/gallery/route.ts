import { NextResponse } from "next/server";
import { searchEbayActiveListings, isDealFinderConnected } from "@/lib/deals/ebay-active";
import {
  defaultMarketQueries,
  enrichMarketGalleryListings,
  getDemoMarketListings,
  isSportsTradingCardListing,
  shuffleMarketGalleryListings,
  toMarketGalleryListing
} from "@/lib/market/gallery";
import { getClientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(`market-gallery:${getClientKey(request)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many market searches." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const demoMode = searchParams.get("demoMode") === "true";

  if (demoMode) {
    if (process.env.ALLOW_DEMO_PRICING !== "true") {
      return NextResponse.json({ status: "NOT_CONNECTED", message: "Demo Mode is disabled.", listings: [] });
    }
    return NextResponse.json({
      status: "DEMO",
      message: "Demo/Test Data only.",
      listings: enrichMarketGalleryListings(getDemoMarketListings())
    });
  }

  if (!isDealFinderConnected()) {
    return NextResponse.json({
      status: "NOT_CONNECTED",
      message: "Live marketplace not connected yet.",
      listings: []
    });
  }

  const queries = query ? [query] : defaultMarketQueries;
  const settledBatches = await Promise.allSettled(queries.map((term) => searchEbayActiveListings(term, query ? 36 : 10)));
  const batches = settledBatches
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof searchEbayActiveListings>>> => result.status === "fulfilled")
    .map((result) => result.value);
  const seen = new Set<string>();
  const listings = shuffleMarketGalleryListings(enrichMarketGalleryListings(batches
    .flat()
    .filter((listing) => {
      const key = listing.itemId ?? listing.listingUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(toMarketGalleryListing)
    .filter((listing) => isSportsTradingCardListing(listing, { premiumDefault: !query }))))
    .slice(0, 60);

  const failedCount = settledBatches.filter((result) => result.status === "rejected").length;
  const allQueriesFailed = failedCount === queries.length;

  return NextResponse.json({
    status: listings.length ? "FOUND" : allQueriesFailed ? "ERROR" : "NO_LISTINGS",
    message: listings.length
      ? failedCount
        ? `Showing live listings. ${failedCount} market ${failedCount === 1 ? "search" : "searches"} did not respond.`
        : null
      : allQueriesFailed
        ? "Live marketplace search failed. Retry in a moment."
        : "No active listings returned.",
    listings
  });
}
