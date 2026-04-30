import { NextResponse } from "next/server";
import type { Sport } from "@prisma/client";
import { getEbayActiveListings, isDealFinderConnected } from "@/lib/deals/ebay-active";
import { calculateFlipScore, getDealLabel } from "@/lib/deals/score";
import type { DealSearchCard, UndervaluedFind } from "@/lib/deals/types";
import { getSoldPricing } from "@/lib/pricing";
import { getClientKey, rateLimit } from "@/lib/rate-limit";

type DealRequest = {
  cards?: DealSearchCard[];
};

export async function POST(request: Request) {
  const limit = rateLimit(`deals:${getClientKey(request)}`, 12, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many deal searches." }, { status: 429 });

  if (!isDealFinderConnected()) {
    return NextResponse.json({
      status: "NOT_CONNECTED",
      message: "Live deal finder not connected yet.",
      finds: []
    });
  }

  const body = (await request.json()) as DealRequest;
  const cards = (body.cards ?? []).slice(0, 5).filter((card) => card.playerName && card.playerName !== "Needs review");
  if (cards.length === 0) {
    return NextResponse.json({
      status: "NO_INPUT",
      message: "Scan or save cards first, then run the deal finder.",
      finds: []
    });
  }

  const batches = await Promise.all(
    cards.map(async (card) => {
      const [activeListings, soldEstimate] = await Promise.all([getEbayActiveListings(card), getSoldPricing(card)]);
      return activeListings.map<UndervaluedFind>((listing) => {
        const averageSold = soldEstimate.averageEstimateCents;
        const upside = averageSold == null ? null : averageSold - listing.askingPriceCents;
        const confidence = Math.min(0.95, soldEstimate.confidenceScore * (soldEstimate.comps.length >= 3 ? 1 : 0.75));
        const flipScore = calculateFlipScore({ askingPriceCents: listing.askingPriceCents, estimate: soldEstimate, card });

        return {
          player: card.playerName,
          sport: card.sport as Sport,
          year: card.year ?? null,
          brandSet: [card.brand, card.setName].filter(Boolean).join(" / ") || "Needs review",
          cardNumber: card.cardNumber ?? null,
          currentAskingPriceCents: listing.askingPriceCents,
          averageSoldPriceCents: averageSold,
          estimatedUpsideCents: upside,
          confidenceScore: Number(confidence.toFixed(2)),
          marketplaceSource: listing.source,
          listingUrl: listing.listingUrl,
          listingTitle: listing.title,
          dealLabel: getDealLabel(upside, averageSold, confidence),
          flipScore: flipScore.score,
          flipScoreLabel: flipScore.label,
          activeListing: listing,
          soldCompCount: soldEstimate.comps.length
        };
      });
    })
  );

  const finds = batches
    .flat()
    .filter((find) => find.averageSoldPriceCents != null)
    .sort((a, b) => b.flipScore - a.flipScore)
    .slice(0, 20);

  return NextResponse.json({
    status: "FOUND",
    message: finds.length ? null : "No undervalued active listings found from current cards.",
    finds
  });
}
