import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("migration", "create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!jobId) {
      return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Save file
    const storagePath = join(
      process.cwd(),
      "storage",
      "migration",
      user.clinicId,
      jobId
    );
    await mkdir(storagePath, { recursive: true });

    const filePath = join(storagePath, file.name);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Parse CSV preview (first 10 rows)
    const text = new TextDecoder().decode(bytes);
    const lines = text.split("\n").filter((l) => l.trim());
    const headers = lines[0]?.split(",").map((h) => h.trim().replace(/^"|"$/g, "")) ?? [];
    const previewRows = lines.slice(1, 11).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });

    return NextResponse.json({
      filename: file.name,
      sizeBytes: file.size,
      headers,
      totalRows: lines.length - 1,
      preview: previewRows,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[Migration CSV Upload]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
