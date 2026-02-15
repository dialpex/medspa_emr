import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import OpenAI from "openai";
import { TEMPLATE_GENERATOR_SYSTEM_PROMPT } from "@/lib/ai/prompts/template-generator";
import { TEMPLATE_COPILOT_SCHEMA } from "@/lib/ai/schemas/template-copilot-schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("charts", "create");

    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: TEMPLATE_COPILOT_SCHEMA,
      messages: [
        { role: "system", content: TEMPLATE_GENERATOR_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.4,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[AI Templates] Error:", error);
    const message = error instanceof Error ? error.message : "AI chat failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
