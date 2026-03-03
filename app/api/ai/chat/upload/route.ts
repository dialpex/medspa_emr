import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import Anthropic from "@anthropic-ai/sdk";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function extractText(
  file: File
): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return { text: buffer.toString("utf-8") };
  }

  if (name.endsWith(".pdf")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (
        buffer: Buffer
      ) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      if (result.text && result.text.trim().length > 20) {
        return { text: result.text };
      }
    } catch {
      // pdf-parse can fail in some Node.js environments (DOMMatrix, canvas, etc.)
      // Fall through to image-based processing
    }
    return {
      imageBase64: buffer.toString("base64"),
      mimeType: "application/pdf",
    };
  }

  if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    const mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
    return {
      imageBase64: buffer.toString("base64"),
      mimeType,
    };
  }

  throw new Error("Unsupported file type");
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("patients", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const ext = file.name.toLowerCase().split(".").pop();
    if (!ext || !["pdf", "png", "jpg", "jpeg", "txt"].includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: PDF, PNG, JPG, TXT" },
        { status: 400 }
      );
    }

    const { text, imageBase64, mimeType } = await extractText(file);

    // Text files and text-based PDFs — return directly
    if (text && !imageBase64) {
      return NextResponse.json({ text, fileName: file.name });
    }

    // Image or scanned PDF — use Anthropic vision to extract text
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI vision service not configured (ANTHROPIC_API_KEY)" },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const isPdf = mimeType === "application/pdf";

    // Build the content block: PDFs use "document" type, images use "image" type
    const fileBlock = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: imageBase64!,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
            data: imageBase64!,
          },
        };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "Extract all text from this invoice/receipt. Preserve line items, quantities, prices, lot numbers, and expiration dates exactly as shown. Return only the extracted text, no commentary.",
            },
          ],
        },
      ],
    });

    const extractedText =
      response.content[0]?.type === "text" ? response.content[0].text : null;
    if (!extractedText) {
      return NextResponse.json(
        { error: "Could not extract text from image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: extractedText, fileName: file.name });
  } catch (error) {
    console.error("[Invoice Upload] Error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    if (
      message.includes("Permission denied") ||
      message.includes("Authentication required")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
