import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma, Sport } from "@prisma/client";
import { authOptions, getDemoUser } from "@/lib/auth";
import { buildCardQuery, normalizeCardQuery } from "@/lib/card-normalize";
import { getSoldPricing } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { cardSaveSchema, normalizeScanResult } from "@/lib/validation";

async function currentUserId() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  return (await getDemoUser()).id;
}

export async function GET(request: Request) {
  const userId = await currentUserId();
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport");
  const search = searchParams.get("search");
  const cardWhere: Prisma.CardWhereInput = {};
  if (sport && sport !== "ALL") cardWhere.sport = sport as Sport;
  if (search) {
    cardWhere.OR = [
      { playerName: { contains: search } },
      { team: { contains: search } },
      { brand: { contains: search } },
      { setName: { contains: search } }
    ];
  }

  const items = await prisma.collectionItem.findMany({
    where: { userId, card: cardWhere },
    include: { card: true },
    orderBy: { createdAt: "desc" }
  });

  const sportTotals = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.card.sport] = (acc[item.card.sport] ?? 0) + (item.estimatedValueCents ?? 0);
    return acc;
  }, {});

  return NextResponse.json({
    items,
    summary: {
      totalCards: items.length,
      totalValueCents: items.reduce((sum, item) => sum + (item.estimatedValueCents ?? 0), 0),
      sportTotals,
      highestValueCards: [...items].sort((a, b) => (b.estimatedValueCents ?? 0) - (a.estimatedValueCents ?? 0)).slice(0, 5),
      recentlyAddedCards: items.slice(0, 5)
    }
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  const raw = cardSaveSchema.parse(await request.json());
  const data = normalizeScanResult(raw);
  const identity = {
    sport: data.sport,
    playerName: data.playerName,
    year: data.year,
    brand: data.brand,
    setName: data.setName,
    cardNumber: data.cardNumber,
    parallel: data.parallel,
    serialNumber: data.serialNumber
  };

  const card = await prisma.card.create({
    data: {
      ...identity,
      rookieFlag: data.rookieFlag,
      autographFlag: data.autographFlag,
      relicFlag: data.relicFlag,
      team: data.team,
      normalizedQuery: normalizeCardQuery(identity)
    }
  });

  const estimate = await getSoldPricing(identity);
  const sourceRecords = await Promise.all(
    [...new Set(estimate.comps.map((comp) => comp.source))].map((name) =>
      prisma.marketplaceSource.upsert({
        where: { name },
        update: { supportsSold: true },
        create: { name, supportsSold: true, websiteUrl: name === "eBay" ? "https://www.ebay.com" : null }
      })
    )
  );
  const sourceByName = new Map(sourceRecords.map((source) => [source.name, source.id]));

  await prisma.priceComp.createMany({
    data: estimate.comps.map((comp) => ({
      cardId: card.id,
      sourceId: sourceByName.get(comp.source),
      title: comp.title,
      salePriceCents: comp.salePriceCents,
      currency: comp.currency,
      soldAt: comp.soldAt ? new Date(comp.soldAt) : null,
      listingUrl: comp.listingUrl,
      condition: comp.condition,
      gradeCompany: comp.gradeCompany,
      gradeValue: comp.gradeValue,
      isDemo: comp.isDemo ?? false
    }))
  });

  const item = await prisma.collectionItem.create({
    data: {
      userId,
      cardId: card.id,
      purchasePriceCents: raw.purchasePriceCents,
      estimatedValueCents: raw.estimatedValueCents ?? estimate.averageEstimateCents,
      condition: raw.condition,
      notes: raw.notes,
      status: raw.status
    },
    include: { card: true }
  });

  return NextResponse.json({
    item,
    estimate,
    pricingQuery: buildCardQuery(identity),
    disclaimer: "Card values are estimates based on recent sales and are not guaranteed. Always verify before buying or selling."
  });
}
