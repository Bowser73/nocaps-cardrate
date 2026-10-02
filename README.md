# NoCaps CardRate

NoCaps CardRate is an original mobile-first full-stack app for scanning, identifying, pricing, and tracking sports trading cards across multiple sports.

A NoCapsAI product.

## Features

- Image upload or phone camera capture
- Server-side OpenAI vision card recognition with sport classification
- Editable review screen before saving
- Sold-pricing provider scaffold (legacy eBay API retired); manual Pokémon sale-evidence analysis
- Personal collection dashboard with value by sport, search, filters, recent cards, and highest-value cards
- Marketplace Spotlight module scaffold for future active listing feeds and watchlist saves

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Add `DATABASE_URL`, `NEXTAUTH_SECRET`, and optional `OPENAI_API_KEY` / `EBAY_CLIENT_ID`.
   SportsCardsPro placeholders are available via `SPORTSCARDSPRO_API_KEY` and `SPORTSCARDSPRO_ENABLED=false`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:migrate`.
6. Run `npm run dev`.

## Pricing Rules

The production pricing path uses sold listings only; the legacy eBay connection is currently unavailable. If eBay credentials are missing, the app displays `Live pricing not connected yet.` If credentials are connected but sold comps are unavailable, it displays `No reliable sold comps found.` Demo comps appear only when `ALLOW_DEMO_PRICING=true` and are labeled demo/test pricing.

## Security

- OpenAI and marketplace credentials stay server-side.
- Uploads are compressed client-side and validated by type, with each prepared image capped at 15 MB.
- API routes include basic rate limiting.
- `.env.example` documents required secrets without exposing real keys.

## Disclaimer

NoCaps CardRate. A NoCapsAI product. Card values are estimates based on recent sales and are not guaranteed. Always verify before buying or selling.


## Pokémon Intelligence

Open `/intelligence` using the banner on the home page. Optional front/back AI recognition uses the existing server-only `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` settings. Review all detected details; raw-card condition must be confirmed manually.

The evidence engine requires exact name, set, collector number, variant, language, condition and grading company/grade matches. It rejects non-USD, invalid, future and older-than-180-day sales and duplicate source paths. At least three matches are required for a median and observed range. Evidence quality is descriptive, not a calibrated probability. Sales in this workspace are user supplied and not independently verified. They stay in memory and are cleared by refresh.

The legacy eBay Finding API was decommissioned in February 2025. Production pricing now explicitly reports that automatic sold pricing is unavailable. A supported licensed sold-data integration is still required; active listings must never substitute for completed-sale evidence. Demo pricing remains explicitly opt-in. No database migration is required by this change.

Run `node --experimental-strip-types --test lib/intelligence/pokemon.test.ts` (Node 22.18+ or 24+) for valuation regression tests.
