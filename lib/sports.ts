import type { Sport } from "@prisma/client";

export const sportOptions: Array<{ value: Sport; label: string; icon: string }> = [
  { value: "BASEBALL", label: "Baseball", icon: "MLB" },
  { value: "FOOTBALL", label: "Football", icon: "NFL" },
  { value: "BASKETBALL", label: "Basketball", icon: "NBA" },
  { value: "HOCKEY", label: "Hockey", icon: "NHL" },
  { value: "SOCCER", label: "Soccer", icon: "FC" },
  { value: "COMBAT", label: "Combat", icon: "KO" },
  { value: "POKEMON_TCG", label: "Pokemon / TCG", icon: "TCG" },
  { value: "RACING", label: "Racing", icon: "CAR" },
  { value: "ENTERTAINMENT", label: "Entertainment", icon: "WWE" },
  { value: "OTHER", label: "Other", icon: "ALL" }
];

export function sportLabel(value?: string | null) {
  return sportOptions.find((sport) => sport.value === value)?.label ?? "Other";
}
