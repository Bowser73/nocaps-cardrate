import { NextResponse } from "next/server";

export async function GET() {
  const hasClientId = Boolean(process.env.EBAY_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.EBAY_CLIENT_SECRET);
  const connected = hasClientId && hasClientSecret;
  const pending = hasClientId !== hasClientSecret || (!connected && process.env.EBAY_STATUS === "pending");
  const sportsCardsProConnected = process.env.SPORTSCARDSPRO_ENABLED === "true" && Boolean(process.env.SPORTSCARDSPRO_API_KEY);

  return NextResponse.json({
    ebay: {
      status: connected ? "Connected" : pending ? "Pending" : "Not connected",
      hasClientId,
      hasClientSecret,
      message: connected
        ? "eBay credentials are configured. Live sold comps and active listings can be requested."
        : pending
          ? "eBay connection pending. Add both EBAY_CLIENT_ID and EBAY_CLIENT_SECRET when approved."
          : "No live marketplace data connected yet. Live active listings require EBAY_CLIENT_ID and EBAY_CLIENT_SECRET."
    },
    demo: {
      allowed: process.env.ALLOW_DEMO_PRICING === "true",
      message:
        process.env.ALLOW_DEMO_PRICING === "true"
          ? "Demo Mode is available. Demo/Test Data is isolated from real comps."
          : "Demo Mode is disabled. Set ALLOW_DEMO_PRICING=true to enable test-only values."
    },
    sportsCardsPro: {
      status: sportsCardsProConnected ? "Connected" : "Not connected",
      enabled: process.env.SPORTSCARDSPRO_ENABLED === "true",
      hasApiKey: Boolean(process.env.SPORTSCARDSPRO_API_KEY),
      message: sportsCardsProConnected
        ? "SportsCardsPro price guide credentials are configured."
        : "Available later. Current pricing uses eBay sold comps."
    }
  });
}
