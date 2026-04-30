import { z } from "zod";

export const sportSchema = z.enum(["BASEBALL", "FOOTBALL", "BASKETBALL", "HOCKEY", "SOCCER", "COMBAT", "POKEMON_TCG", "RACING", "ENTERTAINMENT", "OTHER"]);

const nullableString = z.string().nullable().optional();
const uncertainYear = z.preprocess((value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}$/.test(trimmed)) return Number(trimmed);
    return null;
  }
  return value ?? null;
}, z.number().int().min(1800).max(2100).nullable());

export const scanResultSchema = z.object({
  sport: sportSchema.nullable().optional(),
  playerName: nullableString,
  year: uncertainYear.optional(),
  brand: nullableString,
  setName: nullableString,
  cardNumber: nullableString,
  parallel: nullableString,
  serialNumber: nullableString,
  rookieFlag: z.boolean().nullable().optional(),
  autographFlag: z.boolean().nullable().optional(),
  relicFlag: z.boolean().nullable().optional(),
  team: nullableString,
  conditionNotes: z.object({
    centering: nullableString,
    corners: nullableString,
    edges: nullableString,
    surface: nullableString,
    overall: nullableString
  }).nullable().optional(),
  gradingHelper: z.object({
    worthConsidering: z.boolean().nullable().optional(),
    rationale: nullableString
  }).nullable().optional(),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  uncertainFields: z.array(z.string()).nullable().optional()
});

export type ScanResult = {
  sport: z.infer<typeof sportSchema>;
  playerName: string;
  year: number | null;
  brand: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookieFlag: boolean;
  autographFlag: boolean;
  relicFlag: boolean;
  team: string;
  conditionNotes: {
    centering: string;
    corners: string;
    edges: string;
    surface: string;
    overall: string;
  };
  gradingHelper: {
    worthConsidering: boolean;
    rationale: string;
  };
  confidenceScore: number;
  uncertainFields: string[];
};

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function safeText(value: unknown, fallback = "") {
  const trimmed = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  return trimmed ? trimmed : fallback;
}

function safeSport(value: unknown): z.infer<typeof sportSchema> {
  const parsed = sportSchema.safeParse(value);
  return parsed.success ? parsed.data : "OTHER";
}

function safeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.toLowerCase());
  return false;
}

function safeYear(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1800 && value <= 2100) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    const year = Number(value.trim());
    return year >= 1800 && year <= 2100 ? year : null;
  }
  return null;
}

function safeConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

export function normalizeScanResult(input: unknown): ScanResult {
  const parsed = asRecord(input);
  const conditionNotes = asRecord(parsed.conditionNotes);
  const gradingHelper = asRecord(parsed.gradingHelper);
  const uncertain = new Set(
    Array.isArray(parsed.uncertainFields)
      ? parsed.uncertainFields.map((field) => safeText(field)).filter(Boolean)
      : []
  );

  for (const field of ["playerName", "year", "brand", "setName", "cardNumber", "parallel", "serialNumber", "team"]) {
    const value = parsed[field];
    if (value === null || value === undefined || value === "") uncertain.add(field);
  }

  return {
    sport: safeSport(parsed.sport),
    playerName: safeText(parsed.playerName, "Needs review"),
    year: safeYear(parsed.year),
    brand: safeText(parsed.brand, "Needs review"),
    setName: safeText(parsed.setName, "Needs review"),
    cardNumber: safeText(parsed.cardNumber, "Needs review"),
    parallel: safeText(parsed.parallel),
    serialNumber: safeText(parsed.serialNumber),
    rookieFlag: safeBoolean(parsed.rookieFlag),
    autographFlag: safeBoolean(parsed.autographFlag),
    relicFlag: safeBoolean(parsed.relicFlag),
    team: safeText(parsed.team, "Needs review"),
    conditionNotes: {
      centering: safeText(conditionNotes.centering, "Needs review"),
      corners: safeText(conditionNotes.corners, "Needs review"),
      edges: safeText(conditionNotes.edges, "Needs review"),
      surface: safeText(conditionNotes.surface, "Needs review"),
      overall: safeText(conditionNotes.overall, "Needs review")
    },
    gradingHelper: {
      worthConsidering: safeBoolean(gradingHelper.worthConsidering),
      rationale: safeText(gradingHelper.rationale, "No grading rationale provided.")
    },
    confidenceScore: safeConfidence(parsed.confidenceScore),
    uncertainFields: Array.from(uncertain)
  };
}

export const cardSaveSchema = scanResultSchema.extend({
  purchasePriceCents: z.number().int().min(0).nullable().optional(),
  estimatedValueCents: z.number().int().min(0).nullable().optional(),
  condition: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["RAW", "GRADED", "LISTED", "SOLD"]).default("RAW")
});

export const priceRequestSchema = z.object({
  sport: sportSchema,
  playerName: z.string().min(1),
  year: z.number().int().nullable().optional(),
  brand: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  cardNumber: z.string().nullable().optional(),
  parallel: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  rookieFlag: z.boolean().nullable().optional()
});
