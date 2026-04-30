import type { PricingCard, PricingProvider, SoldComp } from "@/lib/pricing/types";

export class DemoPricingProvider implements PricingProvider {
  name = "Development demo";

  async getSoldComps(card: PricingCard): Promise<SoldComp[]> {
    if (process.env.ALLOW_DEMO_PRICING !== "true") return [];
    const base = Math.max(800, (card.playerName.length + ((card.year ?? 2000) % 100)) * 95);
    return [0.78, 1, 1.27].map((multiplier, index) => ({
      title: `[DEMO ONLY] ${card.year ?? ""} ${card.brand ?? ""} ${card.playerName}`.trim(),
      salePriceCents: Math.round(base * multiplier),
      currency: "USD",
      soldAt: new Date(Date.now() - (index + 1) * 7 * 86400000).toISOString(),
      source: this.name,
      condition: "Development-only comp",
      isDemo: true,
      saleType: index === 2 ? "GRADED" : "RAW"
    }));
  }
}
