import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const { clinicId } = await params;
    const dir = path.join(process.cwd(), "storage/logos", clinicId);
    const files = await readdir(dir);
    const logoFile = files.find((f) => f.startsWith("logo"));

    if (!logoFile) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }

    const ext = path.extname(logoFile).toLowerCase();
    const filePath = path.join(dir, logoFile);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }
}
