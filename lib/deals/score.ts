import type { DealLabel, DealSearchCard, FlipScoreLabel } from "@/lib/deals/types";
import type { PriceEstimate } from "@/lib/pricing/types";

export function getDealLabel(upsideCents: number | null, averageSoldCents: number | null, confidence: number): DealLabel {
  if (upsideCents == null || averageSoldCents == null || averageSoldCents <= 0) return "Needs Research";
  const spread = upsideCents / averageSoldCents;
  if (confidence < 0.35) return "Needs Research";
  if (spread >= 0.25 && confidence >= 0.65) return "Strong Deal";
  if (spread >= 0.12) return "Possible Deal";
  if (spread > 0) return "Needs Research";
  return "Avoid";
}

export function getFlipScoreLabel(score: number): FlipScoreLabel {
  if (score >= 80) return "Strong Buy";
  if (score >= 60) return "Watch";
  if (score >= 40) return "Risky";
  return "Avoid";
}

export function calculateFlipScore({
  askingPriceCents,
  estimate,
  card
}: {
  askingPriceCents: number;
  estimate: PriceEstimate;
  card: DealSearchCard;
}) {
  const avg = estimate.averageEstimateCents;
  const priceGap = avg && avg > 0 ? Math.max(0, (avg - askingPriceCents) / avg) : 0;
  const gradedSpread = estimate.valueInsights.gradingSpreadCents ?? 0;
  const gradedSpreadScore = avg && avg > 0 ? Math.min(18, Math.max(0, (gradedSpread / avg) * 18)) : 0;
  const salesVolumeScore = Math.min(16, estimate.comps.length * 2);
  const confidenceScore = Math.round(estimate.confidenceScore * 18);
  const rookieScore = card.rookieFlag ? 8 : 0;
  const parallelScore = card.parallel && card.parallel.toLowerCase() !== "needs review" ? 8 : 0;

  const score = Math.round(
    Math.min(100, priceGap * 32 + gradedSpreadScore + salesVolumeScore + confidenceScore + rookieScore + parallelScore)
  );

  return { score, label: getFlipScoreLabel(score) };
}
