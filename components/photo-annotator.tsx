"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { XIcon, UndoIcon, CircleDotIcon, MinusIcon, PencilIcon, ArrowRightIcon, SquareIcon, TypeIcon } from "lucide-react";
import type { Annotation, AnnotationTool } from "@/lib/types/charts";
import { updatePhotoAnnotations } from "@/lib/actions/photos";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

interface PhotoAnnotatorProps {
  photoId: string;
  photoUrl: string;
  initialAnnotations: string | null;
  onClose: () => void;
}

interface PendingPoint {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
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
  const unitsInputRef = useRef<HTMLInputElement>(null);
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
  const containerSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Pending point waiting for units input
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
  const [pendingUnits, setPendingUnits] = useState("");

  // Pending text waiting for text input
  const [pendingText, setPendingText] = useState<PendingPoint | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  // For line tool
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  // For arrow tool
  const arrowStartRef = useRef<{ x: number; y: number } | null>(null);
  // For rect tool
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const rectCurrentRef = useRef<{ x: number; y: number } | null>(null);
  // For freehand
  const drawingRef = useRef(false);
  const freehandPointsRef = useRef<{ x: number; y: number }[]>([]);

  const getNormalizedCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  useEffect(() => {
    if (imgLoaded && containerRef.current && !containerSizeRef.current) {
      containerSizeRef.current = {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      };
    }
  }, [imgLoaded]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const size = containerSizeRef.current;
    if (size) {
      const maxW = size.width - 32;
      const maxH = size.height - 32;
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
        const label = String(ann.label ?? ann.number);
        const radius = label.length > 2 ? 24 : 18;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        // Outline for visibility
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
      } else if (ann.type === "arrow") {
        const x1 = ann.x1 * canvas.width;
        const y1 = ann.y1 * canvas.height;
        const x2 = ann.x2 * canvas.width;
        const y2 = ann.y2 * canvas.height;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 16;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (ann.type === "rect") {
        const rx = ann.x * canvas.width;
        const ry = ann.y * canvas.height;
        const rw = ann.w * canvas.width;
        const rh = ann.h * canvas.height;
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (ann.type === "text") {
        const tx = ann.x * canvas.width;
        const ty = ann.y * canvas.height;
        ctx.font = "bold 18px sans-serif";
        const metrics = ctx.measureText(ann.text);
        const padding = 6;
        ctx.fillStyle = ann.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.roundRect(tx - padding, ty - 16 - padding, metrics.width + padding * 2, 22 + padding * 2, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(ann.text, tx, ty);
      }
    }

    // Draw live rect preview
    if (rectStartRef.current && rectCurrentRef.current) {
      const rs = rectStartRef.current;
      const rc = rectCurrentRef.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        Math.min(rs.x, rc.x) * canvas.width,
        Math.min(rs.y, rc.y) * canvas.height,
        Math.abs(rc.x - rs.x) * canvas.width,
        Math.abs(rc.y - rs.y) * canvas.height
      );
      ctx.setLineDash([]);
    }

    // Draw pending point as a ghost circle
    if (pendingPoint) {
      const px = pendingPoint.x * canvas.width;
      const py = pendingPoint.y * canvas.height;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [annotations, imgLoaded, pendingPoint, pendingText, color]);

  useEffect(() => { redraw(); }, [redraw]);

  // Focus input when pending point appears
  useEffect(() => {
    if (pendingPoint && unitsInputRef.current) {
      unitsInputRef.current.focus();
    }
  }, [pendingPoint]);

  // Focus input when pending text appears
  useEffect(() => {
    if (pendingText && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [pendingText]);

  const confirmPendingPoint = () => {
    if (!pendingPoint) return;
    const value = pendingUnits.trim();
    if (!value) return;
    setAnnotations((prev) => [
      ...prev,
      {
        type: "point",
        id: `p_${Date.now()}`,
        x: pendingPoint.x,
        y: pendingPoint.y,
        number: prev.filter((a) => a.type === "point").length + 1,
        label: value,
        color,
      },
    ]);
    setPendingPoint(null);
    setPendingUnits("");
  };

  const cancelPendingPoint = () => {
    setPendingPoint(null);
    setPendingUnits("");
  };

  const confirmPendingText = () => {
    if (!pendingText) return;
    const value = pendingTextValue.trim();
    if (!value) return;
    setAnnotations((prev) => [
      ...prev,
      {
        type: "text",
        id: `t_${Date.now()}`,
        x: pendingText.x,
        y: pendingText.y,
        text: value,
        color,
      },
    ]);
    setPendingText(null);
    setPendingTextValue("");
  };

  const cancelPendingText = () => {
    setPendingText(null);
    setPendingTextValue("");
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // If there's a pending point or text, cancel it first
    if (pendingPoint) {
      cancelPendingPoint();
      return;
    }
    if (pendingText) {
      cancelPendingText();
      return;
    }

    const coords = getNormalizedCoords(e);
    if (!coords) return;

    if (tool === "point") {
      setPendingPoint({
        x: coords.x,
        y: coords.y,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setPendingUnits("");
    } else if (tool === "line") {
      if (!lineStartRef.current) {
        lineStartRef.current = coords;
      } else {
        const start = lineStartRef.current;
        lineStartRef.current = null;
        setAnnotations((prev) => [
          ...prev,
          {
            type: "line",
            id: `l_${Date.now()}`,
            x1: start.x,
            y1: start.y,
            x2: coords.x,
            y2: coords.y,
            color,
          },
        ]);
      }
    } else if (tool === "arrow") {
      if (!arrowStartRef.current) {
        arrowStartRef.current = coords;
      } else {
        const start = arrowStartRef.current;
        arrowStartRef.current = null;
        setAnnotations((prev) => [
          ...prev,
          {
            type: "arrow",
            id: `a_${Date.now()}`,
            x1: start.x,
            y1: start.y,
            x2: coords.x,
            y2: coords.y,
            color,
          },
        ]);
      }
    } else if (tool === "text") {
      setPendingText({
        x: coords.x,
        y: coords.y,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setPendingTextValue("");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getNormalizedCoords(e);
    if (!coords) return;
    if (tool === "freehand") {
      drawingRef.current = true;
      freehandPointsRef.current = [coords];
    } else if (tool === "rect") {
      drawingRef.current = true;
      rectStartRef.current = coords;
      rectCurrentRef.current = coords;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getNormalizedCoords(e);
    if (!coords) return;
    if (tool === "freehand" && drawingRef.current) {
      freehandPointsRef.current.push(coords);
    } else if (tool === "rect" && drawingRef.current) {
      rectCurrentRef.current = coords;
      redraw();
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
    } else if (tool === "rect" && drawingRef.current && rectStartRef.current && rectCurrentRef.current) {
      drawingRef.current = false;
      const s = rectStartRef.current;
      const c = rectCurrentRef.current;
      const w = Math.abs(c.x - s.x);
      const h = Math.abs(c.y - s.y);
      if (w > 0.01 || h > 0.01) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: "rect",
            id: `r_${Date.now()}`,
            x: Math.min(s.x, c.x),
            y: Math.min(s.y, c.y),
            w,
            h,
            color,
          },
        ]);
      }
      rectStartRef.current = null;
      rectCurrentRef.current = null;
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

  // Compute popover position clamped to viewport
  const popoverStyle = pendingPoint
    ? {
        left: Math.min(pendingPoint.screenX, window.innerWidth - 200),
        top: Math.max(pendingPoint.screenY - 80, 8),
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
      <div className="bg-white w-full h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTool("point"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); cancelPendingText(); }}
              className={`p-2 rounded-lg ${tool === "point" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Point (injection site)"
            >
              <CircleDotIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("line"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); cancelPendingText(); }}
              className={`p-2 rounded-lg ${tool === "line" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Line"
            >
              <MinusIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("freehand"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); cancelPendingText(); }}
              className={`p-2 rounded-lg ${tool === "freehand" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Freehand draw"
            >
              <PencilIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("arrow"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); cancelPendingText(); }}
              className={`p-2 rounded-lg ${tool === "arrow" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Arrow"
            >
              <ArrowRightIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("rect"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); cancelPendingText(); }}
              className={`p-2 rounded-lg ${tool === "rect" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Rectangle"
            >
              <SquareIcon className="size-5" />
            </button>
            <button
              onClick={() => { setTool("text"); lineStartRef.current = null; arrowStartRef.current = null; cancelPendingPoint(); }}
              className={`p-2 rounded-lg ${tool === "text" ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Text label"
            >
              <TypeIcon className="size-5" />
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
        <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 min-h-0 relative">
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

        {/* Units input popover */}
        {pendingPoint && popoverStyle && (
          <div
            className="fixed z-[70] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-48"
            style={{ left: popoverStyle.left, top: popoverStyle.top }}
          >
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Units / Label
            </label>
            <input
              ref={unitsInputRef}
              type="text"
              value={pendingUnits}
              onChange={(e) => setPendingUnits(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPendingPoint();
                if (e.key === "Escape") cancelPendingPoint();
              }}
              placeholder="e.g. 5"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={confirmPendingPoint}
                disabled={!pendingUnits.trim()}
                className="flex-1 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-40"
              >
                Place
              </button>
              <button
                onClick={cancelPendingPoint}
                className="flex-1 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Text input popover */}
        {pendingText && (() => {
          const style = {
            left: Math.min(pendingText.screenX, window.innerWidth - 200),
            top: Math.max(pendingText.screenY - 80, 8),
          };
          return (
            <div
              className="fixed z-[70] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-48"
              style={style}
            >
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Text Label
              </label>
              <input
                ref={textInputRef}
                type="text"
                value={pendingTextValue}
                onChange={(e) => setPendingTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmPendingText();
                  if (e.key === "Escape") cancelPendingText();
                }}
                placeholder="e.g. Botox 20u"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={confirmPendingText}
                  disabled={!pendingTextValue.trim()}
                  className="flex-1 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-40"
                >
                  Place
                </button>
                <button
                  onClick={cancelPendingText}
                  className="flex-1 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}

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
