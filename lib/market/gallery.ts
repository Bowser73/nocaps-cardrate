import type { ActiveListing } from "@/lib/deals/types";
import { providerSourceLabels } from "@/lib/providers/labels";

export type MarketGalleryListing = {
  id: string;
  title: string;
  imageUrl: string | null;
  listedPriceCents: number;
  shippingPriceCents: number | null;
  sport: "Football" | "Baseball" | "Basketball" | "Other";
  tags: string[];
  source: "eBay Active Listings" | "Demo/Test Data";
  listingUrl: string;
  listedAt: string | null;
  isDemo: boolean;
};

export const defaultMarketQueries = [
  "CJ Stroud rookie card",
  "football rookie card PSA",
  "basketball rookie card PSA",
  "baseball rookie card PSA",
  "Topps Chrome rookie card",
  "Panini Prizm rookie card",
  "football rookie card",
  "CJ Stroud rookie",
  "2023 Prizm football",
  "Topps Chrome rookie",
  "2024 NFL rookie card PSA",
  "2023 NFL rookie card autograph",
  "football rookie patch auto card",
  "Patrick Mahomes rookie card",
  "C.J. Stroud rookie card",
  "Caleb Williams rookie card",
  "baseball rookie card PSA",
  "baseball Bowman Chrome autograph",
  "Shohei Ohtani rookie card",
  "Elly De La Cruz rookie card",
  "Jackson Holliday rookie card",
  "basketball rookie card PSA",
  "basketball Prizm rookie card",
  "Victor Wembanyama rookie card",
  "Anthony Edwards rookie card",
  "Luka Doncic rookie card",
  "PSA 10 sports card",
  "numbered rookie card",
  "rookie autograph sports card",
  "Panini Prizm rookie card",
  "Topps Chrome rookie card",
  "Bowman Chrome 1st autograph"
];

export function inferSportAndTags(title: string) {
  const text = title.toLowerCase();
  const sport: MarketGalleryListing["sport"] = footballTerms.some((term) => text.includes(term)) || /\b(nfl|qb|wr|rb|te)\b/.test(text)
    ? "Football"
    : baseballTerms.some((term) => text.includes(term)) || /\b(mlb)\b/.test(text)
      ? "Baseball"
      : basketballTerms.some((term) => text.includes(term)) || /\b(nba)\b/.test(text)
        ? "Basketball"
        : "Other";
  const tags = [
    /\b(psa|bgs|sgc|cgc|graded|gem mt|gem mint)\b/.test(text) ? "Graded" : null,
    /\b(auto|autograph|signed)\b/.test(text) ? "Autos" : null,
    /\b(numbered|serial|\/\d{1,4})\b/.test(text) ? "Numbered" : null,
    /\b(rookie| rc\b)\b/.test(text) ? "Rookie" : null
  ].filter(Boolean) as string[];
  return { sport, tags };
}

export function isSportsTradingCardListing(listing: Pick<MarketGalleryListing, "title" | "sport" | "tags" | "listedPriceCents">, options: { premiumDefault?: boolean } = {}) {
  const text = listing.title.toLowerCase();
  if (junkTitleTerms.some((term) => text.includes(term))) return false;
  if (!cardSignalPattern.test(text)) return false;
  if (options.premiumDefault && listing.listedPriceCents < 1000) return false;
  return true;
}

export function logMarketGalleryFilterCounts(context: string, beforeCount: number, afterCount: number) {
  console.log("[Market Gallery] filter counts", { context, beforeCount, afterCount });
}

export function toMarketGalleryListing(listing: ActiveListing): MarketGalleryListing {
  const inferred = inferSportAndTags(listing.title);
  return {
    id: listing.itemId ?? listing.listingUrl,
    title: listing.title,
    imageUrl: listing.imageUrl ?? null,
    listedPriceCents: listing.askingPriceCents,
    shippingPriceCents: listing.shippingPriceCents ?? null,
    sport: inferred.sport,
    tags: inferred.tags,
    source: providerSourceLabels.ebayActiveListings,
    listingUrl: listing.listingUrl,
    listedAt: listing.listedAt ?? null,
    isDemo: false
  };
}

export function enrichMarketGalleryListings(listings: MarketGalleryListing[]) {
  const now = Date.now();
  const trendCounts = new Map<string, number>();

  listings.forEach((listing) => {
    const key = getTrendKey(listing);
    if (!key) return;
    trendCounts.set(key, (trendCounts.get(key) ?? 0) + 1);
  });

  return listings.map((listing) => {
    const tags = new Set(listing.tags);
    const listedAt = listing.listedAt ? new Date(listing.listedAt).getTime() : 0;
    const hoursOld = listedAt ? (now - listedAt) / 36e5 : Number.POSITIVE_INFINITY;
    if (hoursOld >= 0 && hoursOld <= 48) tags.add("Recently Listed");
    const trendKey = getTrendKey(listing);
    if (trendKey && (trendCounts.get(trendKey) ?? 0) >= 2) tags.add("Trending");
    return { ...listing, tags: Array.from(tags) };
  });
}

export function shuffleMarketGalleryListings<T extends MarketGalleryListing>(listings: T[]) {
  const scored = listings.map((listing, index) => ({
    listing,
    score: Math.random() * 0.35 + index
  }));
  return scored
    .sort((a, b) => a.score - b.score)
    .map(({ listing }) => listing);
}

function getTrendKey(listing: MarketGalleryListing) {
  const meaningfulWords = listing.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !commonTrendWords.has(word))
    .slice(0, 4);
  if (meaningfulWords.length < 2) return null;
  return `${listing.sport}:${meaningfulWords.join("-")}`;
}

const commonTrendWords = new Set([
  "card",
  "cards",
  "rookie",
  "sports",
  "graded",
  "autograph",
  "auto",
  "numbered",
  "psa",
  "bgs",
  "sgc",
  "topps",
  "panini",
  "prizm",
  "chrome",
  "lot",
  "mint",
  "gem",
  "new"
]);

const junkTitleTerms = [
  "centering tool",
  "card centering",
  "display frame",
  "frame",
  "holder",
  "stand",
  "case",
  "supplies",
  "lot of sleeves",
  "penny sleeves",
  "top loader",
  "toploader",
  "binder",
  "box only",
  "empty box",
  "digital",
  "custom",
  "reprint",
  "proxy",
  "pokémon",
  "pokemon",
  "tcg",
  "magic",
  "yu-gi-oh",
  "cricket",
  "soccer",
  "wwe",
  "ufc"
];

const cardSignalPattern = /\b(card|cards|rookie|rc|psa|bgs|sgc|auto|autograph|patch|refractor|prizm|chrome|bowman|topps|panini|numbered)\b|\/(10|25|50|99|199)\b/i;

const footballTerms = [
  "football",
  "nfl",
  "patrick mahomes",
  "c.j. stroud",
  "cj stroud",
  "caleb williams",
  "garrett wilson",
  "quarterback",
  "chiefs",
  "texans",
  "bears",
  "jets"
];

const baseballTerms = [
  "baseball",
  "bowman",
  "shohei ohtani",
  "elly de la cruz",
  "jackson holliday",
  "topps chrome",
  "yankees",
  "dodgers",
  "orioles",
  "reds"
];

const basketballTerms = [
  "basketball",
  "victor wembanyama",
  "wembanyama",
  "anthony edwards",
  "luka doncic",
  "prizm basketball",
  "hoops",
  "spurs",
  "mavericks",
  "timberwolves"
];

export function getDemoMarketListings(): MarketGalleryListing[] {
  return [
    ["Demo Football Rookie Card PSA 9", "Football", ["Graded", "Rookie"], 4200],
    ["Demo Baseball Autograph Prospect Card", "Baseball", ["Autos"], 2850],
    ["Demo Basketball Numbered Rookie /199", "Basketball", ["Numbered", "Rookie"], 7600],
    ["Demo PSA Graded Sports Card", "Other", ["Graded"], 5150],
    ["Demo Football Autograph Card", "Football", ["Autos"], 3350],
    ["Demo Baseball Rookie Chrome Card", "Baseball", ["Rookie"], 2200]
  ].map(([title, sport, tags, price], index) => ({
    id: `demo-${index}`,
    title: String(title),
    imageUrl: null,
    listedPriceCents: Number(price),
    shippingPriceCents: 499,
    sport: sport as MarketGalleryListing["sport"],
    tags: tags as string[],
    source: "Demo/Test Data",
    listingUrl: "#",
    listedAt: new Date(Date.now() - index * 3600_000).toISOString(),
    isDemo: true
  }));
}
