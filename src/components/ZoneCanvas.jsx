import React, { useEffect, useRef } from "react";
import { rectNormalize } from "../utils/geometry";

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 540;

export default function ZoneCanvas({
  zones,
  detections,
  isDrawingMode,
  selectedZoneType,
  onAddZone,
  zoneTypes,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 });
  const tempRectRef = useRef(null);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    zones.forEach((zone, index) => {
      const { x, y, width, height } = zone.rect;

      ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
      ctx.strokeStyle = "rgba(255, 0, 0, 0.95)";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "rgba(255, 0, 0, 0.95)";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${index + 1}. ${zone.label}`, x + 6, y + 18);
    });

    detections.forEach((person) => {
      const [x, y, width, height] = person.bbox;

      ctx.strokeStyle = "#00ff8c";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#00ff8c";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(
        `person ${(person.score * 100).toFixed(0)}%`,
        x,
        Math.max(14, y - 6)
      );
    });

    const tempRect = tempRectRef.current;
    if (isDrawingMode && tempRect) {
      const r = rectNormalize(tempRect);

      ctx.fillStyle = "rgba(255, 196, 0, 0.18)";
      ctx.strokeStyle = "rgba(255, 196, 0, 0.95)";
      ctx.lineWidth = 2;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [zones, detections, isDrawingMode]);

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event) => {
    if (!isDrawingMode) return;

    drawingRef.current = true;
    const point = getCanvasPoint(event);

    startPointRef.current = point;
    tempRectRef.current = {
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
    };

    redrawCanvas();
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current || !isDrawingMode) return;

    const point = getCanvasPoint(event);
    tempRectRef.current = {
      x1: startPointRef.current.x,
      y1: startPointRef.current.y,
      x2: point.x,
      y2: point.y,
    };

    redrawCanvas();
  };

  const handlePointerUp = () => {
    if (!drawingRef.current || !isDrawingMode || !tempRectRef.current) return;

    drawingRef.current = false;

    const rect = rectNormalize(tempRectRef.current);
    tempRectRef.current = null;

    if (rect.width < 20 || rect.height < 20) {
      redrawCanvas();
      return;
    }

    const zoneMeta = zoneTypes.find((z) => z.key === selectedZoneType);

    onAddZone({
      id: crypto.randomUUID(),
      type: selectedZoneType,
      label: zoneMeta?.label || "Башка",
      rect,
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}