import type { Sport } from "@prisma/client";

type CardLike = {
  sport: Sport;
  playerName: string;
  year?: number | null;
  brand?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  parallel?: string | null;
  serialNumber?: string | null;
};

export function buildCardQuery(card: CardLike) {
  return [card.year, card.brand, card.setName, card.playerName, card.cardNumber ? `#${card.cardNumber}` : null, card.parallel, card.serialNumber]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCardQuery(card: CardLike) {
  return buildCardQuery(card).toLowerCase();
}
