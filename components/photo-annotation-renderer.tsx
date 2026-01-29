"use client";

import { useRef, useEffect, useState } from "react";
import type { Annotation } from "@/lib/types/charts";

interface PhotoAnnotationRendererProps {
  photoUrl: string;
  annotations: string | null;
  className?: string;
}

export function PhotoAnnotationRenderer({
  photoUrl,
  annotations,
  className = "",
}: PhotoAnnotationRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const parsedAnnotations: Annotation[] = annotations
    ? (() => { try { return JSON.parse(annotations); } catch { return []; } })()
    : [];

  useEffect(() => {
    if (!imgLoaded) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    for (const ann of parsedAnnotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 3;

      if (ann.type === "point") {
        const px = ann.x * canvas.width;
        const py = ann.y * canvas.height;
        const label = String(ann.label ?? ann.number);
        const radius = label.length > 2 ? 24 : 18;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = `bold ${label.length > 2 ? 16 : 20}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px, py);
      } else if (ann.type === "line") {
        ctx.beginPath();
        ctx.moveTo(ann.x1 * canvas.width, ann.y1 * canvas.height);
        ctx.lineTo(ann.x2 * canvas.width, ann.y2 * canvas.height);
        ctx.stroke();
      } else if (ann.type === "freehand") {
        if (ann.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x * canvas.width, ann.points[0].y * canvas.height);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * canvas.width, ann.points[i].y * canvas.height);
        }
        ctx.stroke();
      }
    }
  }, [imgLoaded, parsedAnnotations]);

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={photoUrl}
        alt="Photo"
        className="hidden"
        onLoad={() => setImgLoaded(true)}
      />
      <canvas ref={canvasRef} className="w-full h-auto rounded-lg" />
    </div>
  );
}
