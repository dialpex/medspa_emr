import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("patients", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and SVG images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 2MB" },
        { status: 400 }
      );
    }

    const ext = ALLOWED_TYPES[file.type];
    const dir = path.join(process.cwd(), "storage/logos", user.clinicId);
    await mkdir(dir, { recursive: true });

    // Remove any existing logo files
    try {
      const existing = await readdir(dir);
      for (const f of existing) {
        await unlink(path.join(dir, f));
      }
    } catch {
      // Directory may not exist yet
    }

    const filename = `logo${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    const logoUrl = `/api/logo/${user.clinicId}`;

    await prisma.clinic.update({
      where: { id: user.clinicId },
      data: { logoUrl },
    });

    return NextResponse.json({ success: true, logoUrl });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
