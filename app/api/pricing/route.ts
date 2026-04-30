import { NextResponse } from "next/server";
import { getSoldPricing } from "@/lib/pricing";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { priceRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const limit = rateLimit(`pricing:${getClientKey(request)}`, 30, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many pricing requests." }, { status: 429 });

  const body = await request.json();
  const card = priceRequestSchema.parse(body);
  return NextResponse.json(await getSoldPricing(card, {
    demoMode: body.demoMode === true,
    includeDebug: process.env.NODE_ENV !== "production"
  }));
}
