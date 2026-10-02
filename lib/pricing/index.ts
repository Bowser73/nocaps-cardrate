import { DemoPricingProvider } from "@/lib/pricing/demo";
import { buildSoldSearchQuery } from "@/lib/pricing/ebay";
import { calculateEstimate } from "@/lib/pricing/estimate";
import type { PriceEstimate, PricingCard, PricingDebug } from "@/lib/pricing/types";

const demoProvider = new DemoPricingProvider();

export async function getSoldPricing(card: PricingCard, options: { demoMode?: boolean; includeDebug?: boolean } = {}): Promise<PriceEstimate> {
  if (options.demoMode && process.env.ALLOW_DEMO_PRICING === "true") {
    const comps = await demoProvider.getSoldComps(card);
    const estimate = calculateEstimate(comps);
    return withPricingDebug(estimate, {
      exactQuery: buildSoldSearchQuery(card),
      rawSoldCompsReturned: comps.length,
      compsRemovedByFilters: 0,
      removedCompReasons: []
    }, options.includeDebug);
  }

  { // Legacy Finding API was decommissioned; credentials alone cannot enable sold pricing.
    const estimate: PriceEstimate = {
      status: "NOT_CONNECTED",
      message: "Automatic sold pricing is unavailable: the legacy eBay Finding API was retired. Use Pokémon Intelligence to compare verified sale evidence.",
      lowEstimateCents: null,
      averageEstimateCents: null,
      highEstimateCents: null,
      confidenceScore: 0,
      comps: [],
      valueInsights: {
        estimatedRawValueCents: null,
        potentialGradedValueCents: null,
        gradingSpreadCents: null,
        worthGrading: "UNKNOWN",
        rationale: "A supported licensed sold-data provider is required for automatic valuation."
      }
    };
    return withPricingDebug(estimate, {
      exactQuery: buildSoldSearchQuery(card),
      rawSoldCompsReturned: 0,
      compsRemovedByFilters: 0,
      removedCompReasons: []
    }, options.includeDebug);
  }

}

function withPricingDebug(
  estimate: PriceEstimate,
  providerDebug: Pick<PricingDebug, "exactQuery" | "rawSoldCompsReturned" | "compsRemovedByFilters" | "removedCompReasons">,
  includeDebug?: boolean
): PriceEstimate {
  if (!includeDebug) return estimate;
  return {
    ...estimate,
    debug: {
      ...providerDebug,
      broaderQuery: undefined,
      usableComps: estimate.comps.length,
      confidenceScore: estimate.confidenceScore,
      confidenceExplanation: getConfidenceExplanation(estimate),
      activeListingsUsedOnlyAsMarketSentiment: true
    }
  };
}

function getConfidenceExplanation(estimate: PriceEstimate) {
  if (estimate.status !== "FOUND") return "No usable sold comps were available after filtering.";
  const percent = Math.round(estimate.confidenceScore * 100);
  if (percent >= 75) return "High confidence: multiple relevant sold comps with a consistent price range.";
  if (percent >= 45) return "Medium confidence: usable sold comps were found, but volume, recency, or spread limits certainty.";
  return "Low confidence: few usable comps or a wide price spread. Review broader matches before relying on this value.";
}

