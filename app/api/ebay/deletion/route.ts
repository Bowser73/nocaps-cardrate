import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    challengeCode: process.env.EBAY_VERIFICATION_TOKEN ?? "REPLACE_WITH_TOKEN_FROM_ENV"
  });
}
