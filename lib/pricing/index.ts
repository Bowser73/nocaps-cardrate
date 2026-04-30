import { DemoPricingProvider } from "@/lib/pricing/demo";
import { buildSoldSearchQuery, EbaySoldPricingProvider } from "@/lib/pricing/ebay";
import { calculateEstimate } from "@/lib/pricing/estimate";
import type { PriceEstimate, PricingCard, PricingDebug, PricingProvider } from "@/lib/pricing/types";

const ebayProvider = new EbaySoldPricingProvider();
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

  if (!process.env.EBAY_CLIENT_ID) {
    const estimate: PriceEstimate = {
      status: "NOT_CONNECTED",
      message: "Live pricing not connected yet.",
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
        rationale: "Connect eBay API credentials to calculate live value insights."
      }
    };
    return withPricingDebug(estimate, {
      exactQuery: buildSoldSearchQuery(card),
      rawSoldCompsReturned: 0,
      compsRemovedByFilters: 0,
      removedCompReasons: []
    }, options.includeDebug);
  }

  const providers: PricingProvider[] = [ebayProvider];
  if (options.includeDebug) {
    const ebayResult = await ebayProvider.getSoldCompsWithDebug(card);
    return withPricingDebug(calculateEstimate(ebayResult.comps), ebayResult.debug, true);
  }
  const settled = await Promise.allSettled(providers.map((provider) => provider.getSoldComps(card)));
  const comps = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return calculateEstimate(comps);
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
