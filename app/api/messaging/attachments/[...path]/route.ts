import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await requirePermission("messaging", "view");
    const segments = (await params).path;

    // Expect: [clinicId, conversationId, filename]
    if (segments.length !== 3) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const [clinicId, conversationId, filename] = segments;

    // Validate the path corresponds to user's clinic
    if (clinicId !== user.clinicId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext];
    if (!contentType) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const filePath = path.join(
      process.cwd(),
      "storage/messaging",
      clinicId,
      conversationId,
      filename
    );

    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
