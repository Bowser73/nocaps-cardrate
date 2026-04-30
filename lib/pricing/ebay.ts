import { buildCardQuery } from "@/lib/card-normalize";
import { dollarsToCents } from "@/lib/money";
import { providerSourceLabels } from "@/lib/providers/labels";
import type { PricingCard, PricingDebug, PricingProvider, SoldComp } from "@/lib/pricing/types";

type EbayItem = {
  title?: string[];
  viewItemURL?: string[];
  condition?: Array<{ conditionDisplayName?: string[] }>;
  listingInfo?: Array<{ endTime?: string[] }>;
  sellingStatus?: Array<{
    sellingState?: string[];
    currentPrice?: Array<{ __value__?: string; "@currencyId"?: string }>;
  }>;
};

export function buildSoldSearchQuery(card: PricingCard) {
  const parts = [
    card.playerName,
    card.year,
    card.brand,
    card.setName,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.parallel,
    card.serialNumber,
    card.rookieFlag ? "rookie" : null
  ]
    .filter((part) => part && String(part).toLowerCase() !== "needs review")
    .map(String);

  return parts.length > 0 ? parts.join(" ") : buildCardQuery(card);
}

function cleanToken(value?: string | number | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/.\s#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getParallelSignals(parallel?: string | null) {
  const text = cleanToken(parallel);
  if (!text || text === "needs review" || text === "base") return [];
  const signals = new Set<string>();
  if (/\b(silver|prizm)\b/.test(text)) signals.add("silver");
  if (/\b(refractor|chrome)\b/.test(text)) signals.add("refractor");
  if (/\bgold\b/.test(text)) signals.add("gold");
  if (/\bblue\b/.test(text)) signals.add("blue");
  if (/\bred\b/.test(text)) signals.add("red");
  if (/\bgreen\b/.test(text)) signals.add("green");
  if (/\bmojo\b/.test(text)) signals.add("mojo");
  if (/\b(auto|autograph)\b/.test(text)) signals.add("auto");
  if (/\b(patch|rpa|relic)\b/.test(text)) signals.add("patch");
  const numbered = text.match(/\/\s*(10|25|50|99|199)\b/);
  if (numbered) signals.add(`/${numbered[1]}`);
  return Array.from(signals);
}

function getSerialDenominator(serialNumber?: string | null) {
  return cleanToken(serialNumber).match(/\/\s*(10|25|50|99|199)\b/)?.[1] ?? null;
}

const soldJunkTerms = [
  "centering tool",
  "card centering",
  "display frame",
  "holder",
  "stand",
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
  "pokemon",
  "pokémon",
  "tcg",
  "magic",
  "yu-gi-oh",
  "cricket",
  "soccer",
  "wwe",
  "ufc"
];

function scoreSoldComp(card: PricingCard, title: string, condition?: string | null): { accepted: true; score: number; notes: string[] } | { accepted: false; reason: string } {
  const text = cleanToken(title);
  const combinedText = cleanToken(`${title} ${condition ?? ""}`);
  const junkTerm = soldJunkTerms.find((term) => text.includes(term));
  if (junkTerm) return { accepted: false, reason: `Excluded junk term: ${junkTerm}` };
  if (!/\b(card|rookie|rc|psa|bgs|sgc|auto|autograph|patch|refractor|prizm|chrome|bowman|topps|panini|numbered)\b|\/(10|25|50|99|199)\b/.test(text)) {
    return { accepted: false, reason: "Missing sports-card keywords" };
  }

  let score = 0;
  const notes: string[] = [];
  const player = cleanToken(card.playerName);
  const playerParts = player.split(" ").filter(Boolean);
  const lastName = playerParts[playerParts.length - 1];
  if (player && text.includes(player)) {
    score += 35;
    notes.push("player exact");
  } else if (lastName && text.includes(lastName)) {
    score += 22;
    notes.push("player last name");
  } else {
    return { accepted: false, reason: "Player name did not match" };
  }

  if (card.year && text.includes(String(card.year))) {
    score += 14;
    notes.push("year");
  } else if (card.year && /\b(19|20)\d{2}\b/.test(text)) {
    score -= 8;
    notes.push("year not confirmed");
  }
  if (card.brand && text.includes(cleanToken(card.brand))) {
    score += 12;
    notes.push("brand");
  } else if (card.brand) {
    score -= 3;
  }
  if (card.setName) {
    const setWords = cleanToken(card.setName).split(" ").filter((word) => word.length > 2);
    const matches = setWords.filter((word) => text.includes(word)).length;
    if (matches > 0) {
      score += Math.min(16, matches * 5);
      notes.push("set");
    }
  }
  if (card.cardNumber) {
    const number = cleanToken(card.cardNumber).replace(/^#/, "");
    if (new RegExp(`(^|\\s|#)${number}(\\s|$)`).test(text)) {
      score += 18;
      notes.push("card number");
    } else {
      score -= 6;
      notes.push("card number not confirmed");
    }
  }
  const parallelSignals = getParallelSignals(card.parallel);
  const parallelMatches = parallelSignals.filter((signal) => text.includes(signal)).length;
  if (parallelSignals.length > 0) {
    score += parallelMatches > 0 ? Math.min(24, parallelMatches * 12) : -4;
    if (parallelMatches > 0) notes.push("parallel");
    else notes.push("parallel not confirmed");
  }
  const denominator = getSerialDenominator(card.serialNumber);
  if (denominator) {
    if (text.includes(`/${denominator}`)) {
      score += 26;
      notes.push(`numbered /${denominator}`);
    } else {
      score -= 14;
      notes.push(`numbered /${denominator} not confirmed`);
    }
  }
  if (card.rookieFlag && /\b(rookie|rc)\b/.test(text)) {
    score += 8;
    notes.push("rookie");
  }
  if (/\b(psa|bgs|beckett|sgc|cgc|csg|graded|slab|gem mt|gem mint)\b/.test(combinedText)) notes.push("graded");
  if (/\b(raw|ungraded|near mint|nm|excellent|very good|pre-owned)\b/.test(combinedText)) notes.push("raw");
  if (/\b(lot|bundle|pack|break)\b/.test(text)) score -= 18;

  return score >= 25
    ? { accepted: true, score: Math.min(100, Math.max(0, score)), notes }
    : { accepted: false, reason: `Low relevance score (${score})` };
}

function classifySale(title: string, condition?: string | null): SoldComp["saleType"] {
  const text = `${title} ${condition ?? ""}`.toLowerCase();
  if (/\b(psa|bgs|beckett|sgc|cgc|csg|gem mt|gem mint|graded|grade\s?\d|slab)\b/.test(text)) return "GRADED";
  if (/\b(raw|ungraded|near mint|nm|excellent|very good|pre-owned)\b/.test(text)) return "RAW";
  return "UNKNOWN";
}

export class EbaySoldPricingProvider implements PricingProvider {
  name = providerSourceLabels.ebaySoldComps;

  async getSoldComps(card: PricingCard): Promise<SoldComp[]> {
    const result = await this.getSoldCompsWithDebug(card);
    return result.comps;
  }

  async getSoldCompsWithDebug(card: PricingCard): Promise<{ comps: SoldComp[]; debug: Pick<PricingDebug, "exactQuery" | "rawSoldCompsReturned" | "compsRemovedByFilters" | "removedCompReasons"> }> {
    const appId = process.env.EBAY_CLIENT_ID;
    const exactQuery = buildSoldSearchQuery(card);
    const emptyDebug = { exactQuery, rawSoldCompsReturned: 0, compsRemovedByFilters: 0, removedCompReasons: [] };
    if (!appId) return { comps: [], debug: emptyDebug };

    const params = new URLSearchParams({
      "OPERATION-NAME": "findCompletedItems",
      "SERVICE-VERSION": "1.13.0",
      "SECURITY-APPNAME": appId,
      "RESPONSE-DATA-FORMAT": "JSON",
      "REST-PAYLOAD": "true",
      keywords: exactQuery,
      "paginationInput.entriesPerPage": "25",
      sortOrder: "EndTimeSoonest",
      "itemFilter(0).name": "SoldItemsOnly",
      "itemFilter(0).value": "true",
      "itemFilter(1).name": "LocatedIn",
      "itemFilter(1).value": "US"
    });

    // TODO: Swap to eBay Marketplace Insights or another licensed sold-data API when available.
    const response = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, {
      headers: { "User-Agent": "NoCapsCardRate/0.1" },
      next: { revalidate: 900 }
    });
    if (!response.ok) return { comps: [], debug: emptyDebug };
    const data = await response.json();
    const items: EbayItem[] = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];
    const soldItems = items.filter((item) => item.sellingStatus?.[0]?.sellingState?.[0] === "EndedWithSales");
    const removedCompReasons: Array<{ title: string; reason: string }> = [];

    const comps = soldItems
      .flatMap((item) => {
        const price = item.sellingStatus?.[0]?.currentPrice?.[0];
        const title = item.title?.[0] ?? "Sold trading card";
        const condition = item.condition?.[0]?.conditionDisplayName?.[0] ?? null;
        const relevance = scoreSoldComp(card, title, condition);
        if (!relevance.accepted) {
          removedCompReasons.push({ title, reason: relevance.reason });
          return [];
        }
        return [{
          title,
          salePriceCents: dollarsToCents(Number(price?.__value__ ?? 0)),
          currency: price?.["@currencyId"] ?? "USD",
          soldAt: item.listingInfo?.[0]?.endTime?.[0] ?? null,
          source: this.name,
          listingUrl: item.viewItemURL?.[0] ?? null,
          condition,
          saleType: classifySale(title, condition),
          relevanceScore: relevance.score,
          matchNotes: relevance.notes
        }];
      })
      .filter((comp) => comp.salePriceCents > 0);

    return {
      comps,
      debug: {
        exactQuery,
        rawSoldCompsReturned: soldItems.length,
        compsRemovedByFilters: removedCompReasons.length,
        removedCompReasons: removedCompReasons.slice(0, 5)
      }
    };
  }
}
