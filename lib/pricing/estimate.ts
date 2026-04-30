import type { PriceEstimate, SoldComp, ValueInsights } from "@/lib/pricing/types";

function averageCents(comps: SoldComp[]) {
  if (comps.length === 0) return null;
  return Math.round(comps.reduce((sum, comp) => sum + comp.salePriceCents, 0) / comps.length);
}

function medianCents(comps: SoldComp[]) {
  if (comps.length === 0) return null;
  const sorted = [...comps].sort((a, b) => a.salePriceCents - b.salePriceCents);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1].salePriceCents + sorted[middle].salePriceCents) / 2)
    : sorted[middle].salePriceCents;
}

function removeOutliers(comps: SoldComp[]) {
  if (comps.length < 5) return comps;
  const median = medianCents(comps);
  if (!median) return comps;
  return comps.filter((comp) => comp.salePriceCents >= median * 0.25 && comp.salePriceCents <= median * 4);
}

function getConfidenceScore(comps: SoldComp[], averageEstimateCents: number) {
  const countScore = Math.min(0.42, comps.length * 0.045);
  const relevanceAverage = comps.reduce((sum, comp) => sum + (comp.relevanceScore ?? 55), 0) / comps.length;
  const relevanceScore = Math.min(0.28, (relevanceAverage / 100) * 0.28);
  const strongMatchCount = comps.filter((comp) => (comp.relevanceScore ?? 0) >= 70).length;
  const strongMatchScore = Math.min(0.1, strongMatchCount * 0.025);
  const recentCount = comps.filter((comp) => {
    if (!comp.soldAt) return false;
    const daysOld = (Date.now() - new Date(comp.soldAt).getTime()) / 86400000;
    return daysOld >= 0 && daysOld <= 180;
  }).length;
  const recencyScore = Math.min(0.15, recentCount * 0.025);
  const prices = comps.map((comp) => comp.salePriceCents);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const spreadRatio = averageEstimateCents > 0 ? (high - low) / averageEstimateCents : 1;
  const spreadPenalty = Math.min(0.2, Math.max(0, spreadRatio - 1.2) * 0.08);
  const saleTypes = new Set(comps.map((comp) => comp.saleType ?? "UNKNOWN"));
  const mixedRawGradedPenalty = saleTypes.has("RAW") && saleTypes.has("GRADED") ? 0.08 : 0;
  return Number(Math.min(0.95, Math.max(0.18, countScore + relevanceScore + strongMatchScore + recencyScore - spreadPenalty - mixedRawGradedPenalty)).toFixed(2));
}

function getValueInsights(comps: SoldComp[], averageEstimateCents: number | null): ValueInsights {
  const rawComps = comps.filter((comp) => comp.saleType === "RAW");
  const gradedComps = comps.filter((comp) => comp.saleType === "GRADED");
  const rawAverage = averageCents(rawComps) ?? averageEstimateCents;
  const gradedAverage = averageCents(gradedComps);
  const spread = rawAverage != null && gradedAverage != null ? gradedAverage - rawAverage : null;

  if (rawAverage == null) {
    return {
      estimatedRawValueCents: null,
      potentialGradedValueCents: gradedAverage,
      gradingSpreadCents: null,
      worthGrading: "UNKNOWN",
      rationale: "Raw value needs reliable sold comps before grading can be assessed."
    };
  }

  if (gradedAverage == null || spread == null) {
    return {
      estimatedRawValueCents: rawAverage,
      potentialGradedValueCents: null,
      gradingSpreadCents: null,
      worthGrading: "UNKNOWN",
      rationale: "No reliable graded sold comps found for a safe grading spread."
    };
  }

  if (spread >= 7500 && spread >= rawAverage * 0.75) {
    return {
      estimatedRawValueCents: rawAverage,
      potentialGradedValueCents: gradedAverage,
      gradingSpreadCents: spread,
      worthGrading: "YES",
      rationale: "Recent graded comps show a meaningful premium over raw sales."
    };
  }

  if (spread >= 3000 && spread >= rawAverage * 0.35) {
    return {
      estimatedRawValueCents: rawAverage,
      potentialGradedValueCents: gradedAverage,
      gradingSpreadCents: spread,
      worthGrading: "MAYBE",
      rationale: "There is some graded premium, but fees, timing, and condition risk matter."
    };
  }

  return {
    estimatedRawValueCents: rawAverage,
    potentialGradedValueCents: gradedAverage,
    gradingSpreadCents: spread,
    worthGrading: "NO",
    rationale: "The current graded premium does not clearly justify grading costs."
  };
}

export function calculateEstimate(comps: SoldComp[]): PriceEstimate {
  const usable = comps
    .filter((comp) => Number.isFinite(comp.salePriceCents) && comp.salePriceCents > 0)
    .sort((a, b) => a.salePriceCents - b.salePriceCents);
  const outlierFiltered = removeOutliers(usable);
  const rawComps = outlierFiltered.filter((comp) => comp.saleType === "RAW");
  const unknownComps = outlierFiltered.filter((comp) => comp.saleType === "UNKNOWN");
  const filtered = rawComps.length >= 2 ? rawComps : rawComps.length === 1 && unknownComps.length > 0 ? [...rawComps, ...unknownComps] : outlierFiltered;
  if (filtered.length === 0) {
    return {
      status: "NO_COMPS",
      message: "No reliable sold comps found",
      lowEstimateCents: null,
      averageEstimateCents: null,
      highEstimateCents: null,
      confidenceScore: 0,
      comps: [],
      valueInsights: getValueInsights([], null)
    };
  }
  const avg = Math.round(filtered.reduce((sum, comp) => sum + comp.salePriceCents, 0) / filtered.length);
  const recentComps = [...filtered]
    .sort((a, b) => new Date(b.soldAt ?? 0).getTime() - new Date(a.soldAt ?? 0).getTime())
    .slice(0, 12);

  return {
    status: "FOUND",
    lowEstimateCents: filtered[0].salePriceCents,
    averageEstimateCents: avg,
    highEstimateCents: filtered[filtered.length - 1].salePriceCents,
    confidenceScore: getConfidenceScore(filtered, avg),
    comps: recentComps,
    valueInsights: getValueInsights(filtered, avg)
  };
}
