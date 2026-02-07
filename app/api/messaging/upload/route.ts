import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("messaging", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversationId") as string | null;

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: "File and conversationId are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to clinic
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clinicId: true },
    });

    if (!conversation || conversation.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const fileId = generateId();
    const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const filename = `${fileId}${ext}`;
    const storagePath = `storage/messaging/${user.clinicId}/${conversationId}/${filename}`;

    const dir = path.join(
      process.cwd(),
      "storage/messaging",
      user.clinicId,
      conversationId
    );
    await mkdir(dir, { recursive: true });

    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    return NextResponse.json({
      success: true,
      storagePath,
      url: `/api/messaging/attachments/${user.clinicId}/${conversationId}/${filename}`,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
