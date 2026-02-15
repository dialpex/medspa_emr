import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import OpenAI from "openai";
import { TEMPLATE_IMPORT_SYSTEM_PROMPT } from "@/lib/ai/prompts/template-import";
import { TEMPLATE_IMPORT_SCHEMA } from "@/lib/ai/schemas/template-import-schema";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const { text, imageBase64, mimeType } = await extractText(file);

    const openai = new OpenAI({ apiKey });

    type MessageContent = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
    const userContent: MessageContent[] = [];

    if (text) {
      userContent.push({
        type: "text",
        text: `Analyze this document and extract the template structure:\n\n${text.slice(0, 15000)}`,
      });
    }

    if (imageBase64 && mimeType) {
      userContent.push({
        type: "text",
        text: "Analyze this document image and extract the template structure:",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: TEMPLATE_IMPORT_SCHEMA,
      messages: [
        { role: "system", content: TEMPLATE_IMPORT_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    const parsed = JSON.parse(content);
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
