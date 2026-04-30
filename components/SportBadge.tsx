import { Trophy } from "lucide-react";
import { sportLabel } from "@/lib/sports";

export function SportBadge({ sport }: { sport?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs font-semibold text-ink">
      <Trophy className="h-3.5 w-3.5 text-flame" aria-hidden="true" />
      {sportLabel(sport)}
    </span>
  );
}
