import OpenAI from "openai";
import { normalizeScanResult, type ScanResult } from "@/lib/validation";

const fallbackScan: ScanResult = {
  sport: "OTHER",
  playerName: "Unknown athlete",
  year: null,
  brand: "Needs review",
  setName: "Needs review",
  cardNumber: "Needs review",
  parallel: "",
  serialNumber: "",
  rookieFlag: false,
  autographFlag: false,
  relicFlag: false,
  team: "Needs review",
  conditionNotes: {
    centering: "Unable to assess from this image.",
    corners: "Unable to assess from this image.",
    edges: "Unable to assess from this image.",
    surface: "Unable to assess from this image.",
    overall: "OpenAI is not configured. Add OPENAI_API_KEY to enable live card detection."
  },
  gradingHelper: {
    worthConsidering: false,
    rationale: "No reliable card identity or value spread is available yet."
  },
  confidenceScore: 0.1,
  uncertainFields: ["playerName", "year", "brand", "setName", "cardNumber", "team"]
};

type ScanImage = {
  label: "front" | "back";
  base64: string;
  mimeType: string;
};

export async function detectCardFromImage(images: ScanImage[]): Promise<ScanResult> {
  if (!process.env.OPENAI_API_KEY) return fallbackScan;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageParts = images.map((image) => ({
    type: "image_url" as const,
    image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: "high" as const }
  }));

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "You identify sports trading cards from front and optional back images. Return only valid JSON. Prefer visible printed text from the card over guessing. Never invent prices. If year, set, card number, parallel, or team are uncertain, use null or 'Needs review' and include that field name in uncertainFields. If front and back disagree, use 'Needs review' and include the field in uncertainFields. Use sport enums exactly: BASEBALL, FOOTBALL, BASKETBALL, HOCKEY, SOCCER, COMBAT, POKEMON_TCG, RACING, ENTERTAINMENT, OTHER. Use back image clues to confirm card number, copyright year, set, team, stats, and name details. Give condition observations only; never assign an official grade."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Analyze the provided card image(s) together. The first image is the front. If present, the second image is the back. Extract sport, playerName, year, brand, setName, cardNumber, parallel, serialNumber, rookieFlag, autographFlag, relicFlag, team, conditionNotes {centering,corners,edges,surface,overall}, gradingHelper {worthConsidering,rationale}, confidenceScore, uncertainFields."
          },
          ...imageParts
        ]
      }
    ]
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) return fallbackScan;
  try {
    return normalizeScanResult(JSON.parse(raw));
  } catch {
    return normalizeScanResult({
      playerName: "Needs review",
      conditionNotes: { overall: "AI returned a response that needs manual review." },
      gradingHelper: { rationale: "No grading rationale provided." },
      confidenceScore: 0,
      uncertainFields: ["playerName", "year", "cardNumber", "parallel", "serialNumber"]
    });
  }
}
