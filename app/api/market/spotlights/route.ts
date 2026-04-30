import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function currentUserId() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  return (await getDemoUser()).id;
}

export async function GET() {
  const items = await prisma.spotlightItem.findMany({
    where: { isActive: true, confidenceScore: { gte: 0.65 } },
    include: { source: true },
    orderBy: { updatedAt: "desc" },
    take: 30
  });
  return NextResponse.json({
    items,
    message: items.length === 0 ? "No reliable marketplace spotlights are available yet. Connect active listing providers to enable this feed." : null
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  const body = await request.json();
  if (!body.spotlightItemId && !body.cardId) return NextResponse.json({ error: "A card or spotlight item is required." }, { status: 400 });
  const item = await prisma.watchlistItem.create({
    data: { userId, cardId: body.cardId ?? null, spotlightItemId: body.spotlightItemId ?? null, notes: body.notes ?? null }
  });
  return NextResponse.json({ item });
}
