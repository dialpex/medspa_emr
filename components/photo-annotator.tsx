"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { XIcon, UndoIcon, CircleDotIcon, MinusIcon, PencilIcon } from "lucide-react";
import type { Annotation, AnnotationTool } from "@/lib/types/charts";
import { updatePhotoAnnotations } from "@/lib/actions/photos";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

interface PhotoAnnotatorProps {
  photoId: string;
  photoUrl: string;
  initialAnnotations: string | null;
  onClose: () => void;
}

export function PhotoAnnotator({
  photoId,
  photoUrl,
  initialAnnotations,
  onClose,
}: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<AnnotationTool>("point");
  const [color, setColor] = useState(COLORS[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    if (initialAnnotations) {
      try { return JSON.parse(initialAnnotations); } catch { return []; }
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // For line tool: track first click
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  // For freehand: track drawing
  const drawingRef = useRef(false);
  const freehandPointsRef = useRef<{ x: number; y: number }[]>([]);

  const pointCount = annotations.filter((a) => a.type === "point").length;

  const getNormalizedCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Scale canvas display to container
    const container = containerRef.current;
    if (container) {
      const maxW = container.clientWidth;
      const maxH = container.clientHeight - 60;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      canvas.style.width = `${img.naturalWidth * scale}px`;
      canvas.style.height = `${img.naturalHeight * scale}px`;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    for (const ann of annotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 3;

      if (ann.type === "point") {
        const px = ann.x * canvas.width;
        const py = ann.y * canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(ann.number), px, py);
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
  }, [annotations, imgLoaded]);

  useEffect(() => { redraw(); }, [redraw]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const coords = getNormalizedCoords(e);
    if (!coords) return;

    if (tool === "point") {
      setAnnotations((prev) => [
        ...prev,
        {
          type: "point",
          id: `p_${Date.now()}`,
          x: coords.x,
          y: coords.y,
          number: pointCount + 1,
          color,
        },
      ]);
    } else if (tool === "line") {
      if (!lineStartRef.current) {
        lineStartRef.current = coords;
      } else {
        setAnnotations((prev) => [
          ...prev,
          {
            type: "line",
            id: `l_${Date.now()}`,
            x1: lineStartRef.current!.x,
            y1: lineStartRef.current!.y,
            x2: coords.x,
            y2: coords.y,
            color,
          },
        ]);
        lineStartRef.current = null;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "freehand") {
      drawingRef.current = true;
      const coords = getNormalizedCoords(e);
      if (coords) freehandPointsRef.current = [coords];
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tool === "freehand" && drawingRef.current) {
      const coords = getNormalizedCoords(e);
      if (coords) freehandPointsRef.current.push(coords);
    }
  };

  const handleMouseUp = () => {
    if (tool === "freehand" && drawingRef.current) {
      drawingRef.current = false;
      if (freehandPointsRef.current.length > 1) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: "freehand",
            id: `f_${Date.now()}`,
            points: freehandPointsRef.current,
            color,
          },
        ]);
      }
      freehandPointsRef.current = [];
    }
  };

  const undo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleSave = async () => {
    setSaving(true);
    await updatePhotoAnnotations(photoId, JSON.stringify(annotations));
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTool("point"); lineStartRef.current = null; }}
              className={`p-2 rounded-lg ${tool === "point" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Point (injection site)"
            >
              <CircleDotIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("line"); lineStartRef.current = null; }}
              className={`p-2 rounded-lg ${tool === "line" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Line"
            >
              <MinusIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("freehand"); lineStartRef.current = null; }}
              className={`p-2 rounded-lg ${tool === "freehand" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Freehand draw"
            >
              <PencilIcon className="size-5" />
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={undo}
              disabled={annotations.length === 0}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              title="Undo"
            >
              <UndoIcon className="size-5" />
            </button>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 min-h-0">
          {/* Hidden image for loading */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Photo"
            className="hidden"
            onLoad={() => setImgLoaded(true)}
          />
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Annotations"}
          </button>
        </div>
      </div>
    </div>
  );
}
