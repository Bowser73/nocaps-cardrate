import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { detectCardFromImage } from "@/lib/ai/card-detection";
import { authOptions, getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import { normalizeScanResult } from "@/lib/validation";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 15 * 1024 * 1024;

function getImage(formData: FormData, names: string[]) {
  for (const name of names) {
    const value = formData.get(name);
    if (value instanceof File && value.size > 0) return value;
  }
  return null;
}

function validateImage(file: File, label: string) {
  if (!allowedTypes.has(file.type)) return `${label} must be JPEG, PNG, or WebP.`;
  if (file.size > maxBytes) return `${label} image must be 15 MB or smaller after compression.`;
  return null;
}

async function toStoredImage(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    file,
    bytes,
    base64: bytes.toString("base64"),
    hash: createHash("sha256").update(bytes).digest("hex")
  };
}

export async function POST(request: Request) {
  const limit = rateLimit(`scan:${getClientKey(request)}`, 8, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many scans. Please wait a moment." }, { status: 429 });

  const formData = await request.formData();
  const frontFile = getImage(formData, ["frontImage", "image"]);
  const backFile = getImage(formData, ["backImage"]);
  if (!frontFile) return NextResponse.json({ error: "Upload the front of the card." }, { status: 400 });

  const frontError = validateImage(frontFile, "Front");
  if (frontError) return NextResponse.json({ error: frontError }, { status: 400 });
  const backError = backFile ? validateImage(backFile, "Back") : null;
  if (backError) return NextResponse.json({ error: backError }, { status: 400 });

  const front = await toStoredImage(frontFile);
  const back = backFile ? await toStoredImage(backFile) : null;
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? { id: session.user.id } : await getDemoUser();

  try {
    const result = await detectCardFromImage([
      { label: "front", base64: front.base64, mimeType: front.file.type },
      ...(back ? [{ label: "back" as const, base64: back.base64, mimeType: back.file.type }] : [])
    ]);
    const scan = await prisma.scan.create({
      data: {
        userId: user.id,
        imageMimeType: front.file.type,
        imageByteSize: front.file.size,
        imageHash: front.hash,
        detectedSport: result.sport,
        extractedJson: {
          ...result,
          imageSides: { front: true, back: Boolean(back) },
          imageMeta: {
            front: { mimeType: front.file.type, byteSize: front.file.size, hash: front.hash },
            back: back ? { mimeType: back.file.type, byteSize: back.file.size, hash: back.hash } : null
          }
        },
        conditionNotes: result.conditionNotes,
        confidenceScore: result.confidenceScore
      }
    });
    return NextResponse.json({ scanId: scan.id, result });
  } catch (error) {
    console.error("SCAN ERROR:", error);
    const message = error instanceof Error ? error.message : "Scan failed";
    const isFatalAiError =
      /api key|401|403|429|rate limit|quota|network|fetch|timeout/i.test(message);
    const reviewResult = normalizeScanResult({
      playerName: "Needs review",
      conditionNotes: { overall: isFatalAiError ? "AI scan could not complete." : "AI returned partial data that needs review." },
      gradingHelper: { rationale: "No grading rationale provided." },
      confidenceScore: 0,
      uncertainFields: ["playerName", "year", "cardNumber", "parallel", "serialNumber"]
    });

    const scan = await prisma.scan.create({
      data: {
        userId: user.id,
        status: isFatalAiError ? "FAILED" : "REVIEW",
        imageMimeType: front.file.type,
        imageByteSize: front.file.size,
        imageHash: front.hash,
        extractedJson: {
          ...(isFatalAiError ? {} : reviewResult),
          imageMeta: {
            front: { mimeType: front.file.type, byteSize: front.file.size, hash: front.hash },
            back: back ? { mimeType: back.file.type, byteSize: back.file.size, hash: back.hash } : null
          }
        },
        confidenceScore: 0,
        errorMessage: message
      }
    });
    if (isFatalAiError) {
      return NextResponse.json({ error: "Card detection failed.", scanId: scan.id }, { status: 500 });
    }
    return NextResponse.json({ scanId: scan.id, result: reviewResult });
  }
}
