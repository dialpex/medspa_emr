/**
 * Server-side photo annotation compositing using sharp.
 * Renders annotation overlays (SVG) onto photos for PDF export.
 */
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import type { Annotation } from "@/lib/types/charts";

/**
 * Read a photo from disk, composite annotations as SVG overlay, return PNG buffer.
 * Resizes to max 800px width for PDF embedding.
 */
export async function compositePhotoWithAnnotations(
  storagePath: string,
  annotationsJson: string | null
): Promise<Buffer> {
  const fullPath = path.join(process.cwd(), storagePath);
  const rawBuffer = await readFile(fullPath);

  const annotations: Annotation[] = annotationsJson
    ? (() => {
        try {
          return JSON.parse(annotationsJson);
        } catch {
          return [];
        }
      })()
    : [];

  // Resize first
  let img = sharp(rawBuffer).resize({ width: 800, withoutEnlargement: true });
  const resized = await img.png().toBuffer();

  if (annotations.length === 0) {
    return resized;
  }

  // Get dimensions of resized image
  const metadata = await sharp(resized).metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  const svgElements = annotations.map((ann) => renderAnnotationSVG(ann, w, h));

  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgElements.join("")}</svg>`;
  const svgBuffer = Buffer.from(svgOverlay);

  return sharp(resized)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderAnnotationSVG(ann: Annotation, w: number, h: number): string {
  switch (ann.type) {
    case "point": {
      const px = ann.x * w;
      const py = ann.y * h;
      const label = String(ann.label ?? ann.number);
      const radius = label.length > 2 ? 24 : 18;
      const fontSize = label.length > 2 ? 16 : 20;
      return `
        <circle cx="${px}" cy="${py}" r="${radius}" fill="${ann.color}" stroke="white" stroke-width="2"/>
        <text x="${px}" y="${py}" fill="white" font-size="${fontSize}" font-weight="bold"
              font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`;
    }
    case "line": {
      return `<line x1="${ann.x1 * w}" y1="${ann.y1 * h}" x2="${ann.x2 * w}" y2="${ann.y2 * h}"
                stroke="${ann.color}" stroke-width="3"/>`;
    }
    case "freehand": {
      if (ann.points.length < 2) return "";
      const pts = ann.points.map((p) => `${p.x * w},${p.y * h}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${ann.color}" stroke-width="3"/>`;
    }
    case "arrow": {
      const x1 = ann.x1 * w;
      const y1 = ann.y1 * h;
      const x2 = ann.x2 * w;
      const y2 = ann.y2 * h;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 16;
      const ax = x2 - headLen * Math.cos(angle - Math.PI / 6);
      const ay = y2 - headLen * Math.sin(angle - Math.PI / 6);
      const bx = x2 - headLen * Math.cos(angle + Math.PI / 6);
      const by = y2 - headLen * Math.sin(angle + Math.PI / 6);
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ann.color}" stroke-width="3"/>
        <polygon points="${x2},${y2} ${ax},${ay} ${bx},${by}" fill="${ann.color}"/>`;
    }
    case "rect": {
      return `<rect x="${ann.x * w}" y="${ann.y * h}" width="${ann.w * w}" height="${ann.h * h}"
                fill="none" stroke="${ann.color}" stroke-width="3"/>`;
    }
    case "text": {
      const tx = ann.x * w;
      const ty = ann.y * h;
      // Approximate text width (rough: 10px per char at 18px font)
      const textWidth = ann.text.length * 10;
      const padding = 6;
      return `
        <rect x="${tx - padding}" y="${ty - 22}" width="${textWidth + padding * 2}" height="${28 + padding}"
              rx="4" fill="${ann.color}" opacity="0.8"/>
        <text x="${tx}" y="${ty}" fill="white" font-size="18" font-weight="bold"
              font-family="sans-serif" text-anchor="start" dominant-baseline="auto">${escapeXml(ann.text)}</text>`;
    }
    default:
      return "";
  }
}
