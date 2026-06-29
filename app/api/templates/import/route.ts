import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLLMProviderForTier, completionWithRetry } from "@/lib/agents/_shared/llm";
import { TEMPLATE_IMPORT_SYSTEM_PROMPT } from "@/lib/agents/insights/template-import-prompt";
import Anthropic from "@anthropic-ai/sdk";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const VALID_FIELD_TYPES = new Set([
  "text", "textarea", "select", "multiselect", "number",
  "date", "checklist", "signature", "photo-single",
  "heading", "first-name", "last-name",
]);

interface ImportField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
  placeholder?: string | null;
}

interface ImportResult {
  suggestedName: string;
  suggestedType: string;
  suggestedCategory: string;
  fields: ImportField[];
}

async function extractText(file: File): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return { text: buffer.toString("utf-8") };
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value };
  }

  if (name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    if (result.text && result.text.trim().length > 20) {
      return { text: result.text };
    }
    // Scanned PDF — fall through to image-based processing
    return {
      imageBase64: buffer.toString("base64"),
      mimeType: "application/pdf",
    };
  }

  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    const mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
    return {
      imageBase64: buffer.toString("base64"),
      mimeType,
    };
  }

  throw new Error("Unsupported file type");
}

function validateImportResult(parsed: ImportResult): { valid: boolean; error?: string } {
  if (!parsed.suggestedName || typeof parsed.suggestedName !== "string") {
    return { valid: false, error: "Missing suggestedName" };
  }
  if (!["chart", "form"].includes(parsed.suggestedType)) {
    return { valid: false, error: 'suggestedType must be "chart" or "form"' };
  }
  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
    return { valid: false, error: "fields must be a non-empty array" };
  }
  const invalidFields = parsed.fields.filter((f) => !VALID_FIELD_TYPES.has(f.type));
  if (invalidFields.length > 0) {
    return {
      valid: false,
      error: `Invalid field types: ${invalidFields.map((f) => `"${f.type}" on "${f.label}"`).join(", ")}. Valid: ${[...VALID_FIELD_TYPES].join(", ")}`,
    };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("charts", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    const { text, imageBase64, mimeType } = await extractText(file);

    // Text-based documents — use shared LLM provider with retry
    if (text && !imageBase64) {
      const provider = getLLMProviderForTier("triage");
      if (!provider.isAvailable()) {
        return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
      }

      const userMessage = `Analyze this document and extract the template structure. Return ONLY a JSON object with keys: suggestedName, suggestedType ("chart" or "form"), suggestedCategory, fields (array of {key, label, type, required, options, placeholder}).\n\n${text.slice(0, 15000)}`;

      const { result } = await completionWithRetry<ImportResult>(
        provider,
        TEMPLATE_IMPORT_SYSTEM_PROMPT,
        userMessage,
        { temperature: 0.2, maxTokens: 4096 },
        validateImportResult
      );

      return NextResponse.json(result);
    }

    // Image/scanned PDF — needs vision, use Anthropic directly
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Could not extract content from file" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI vision service not configured (ANTHROPIC_API_KEY)" }, { status: 503 });
    }

    const anthropic = new Anthropic();
    const isPdf = mimeType === "application/pdf";

    const fileBlock = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: imageBase64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        };

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: TEMPLATE_IMPORT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: 'Analyze this document image and extract the template structure. Return ONLY a JSON object with keys: suggestedName, suggestedType ("chart" or "form"), suggestedCategory, fields (array of {key, label, type, required, options, placeholder}).',
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const responseText = response.content[0]?.type === "text" ? response.content[0].text : null;
    if (!responseText) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    // Extract JSON from response (may have markdown fences)
    const { extractJSON } = await import("@/lib/agents/_shared/llm/utils");
    const parsed = extractJSON<ImportResult>(responseText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[Template Import] Error:", error);
    const message = error instanceof Error ? error.message : "Import failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
