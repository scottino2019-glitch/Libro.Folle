/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Undo2, Redo2, Trash2, Maximize, RefreshCw } from 'lucide-react';
import { DrawingStroke, DrawingTool, TrackPoint } from '../types';

interface DrawingCanvasProps {
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  
  width: number;  // Display width
  height: number; // Display height
  
  paperStyle: 'pdf' | 'lines' | 'grid' | 'blank';
  isPanning: boolean; // In pan mode, drawing is disabled to allow scrolled navigation
}

export default function DrawingCanvas({
  strokes,
  onAddStroke,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  tool,
  color,
  strokeWidth,
  width,
  height,
  paperStyle,
  isPanning,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPointsRef = useRef<TrackPoint[]>([]);

  // Redraw whenever strokes change or dimensions resize
  useEffect(() => {
    drawAll();
  }, [strokes, width, height, paperStyle]);

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on scale & device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Clear Canvas (with overlay mode)
    ctx.clearRect(0, 0, width, height);

    // 2. Draw Paper Background (lines / grid) if not pdf
    if (paperStyle === 'lines') {
      drawLinesPaper(ctx);
    } else if (paperStyle === 'grid') {
      drawGridPaper(ctx);
    } else if (paperStyle === 'blank') {
      // Just keep blank (transparent or soft cream)
      ctx.fillStyle = 'rgba(255, 253, 246, 0.4)'; // subtle antique warm paper hint
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Draw All Vector Strokes
    strokes.forEach((stroke) => {
      drawStroke(ctx, stroke);
    });
  };

  const drawLinesPaper = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = '#e2e8f0'; // Tailwind slate-200
    ctx.lineWidth = 0.8;
    
    // Vertical margin line in red (similar to legal paper)
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.lineTo(70, height);
    ctx.strokeStyle = '#fca5a5'; // subtle red-300
    ctx.lineWidth = 1;
    ctx.stroke();

    // Horizontal lines
    ctx.strokeStyle = '#cbd5e1'; // slate-300
    ctx.lineWidth = 0.5;
    const lineSpacing = 28; // Standard notebook lines
    for (let y = lineSpacing; y < height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawGridPaper = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = '#e2e8f0'; // slate-200
    ctx.lineWidth = 0.5;
    const gridSize = 20; // 5mm grid approx

    // Vertical columns
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal rows
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = 'rgba(0,0,0,1.0)'; // Color doesn't matter for eraser
    } else if (stroke.type === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply'; // Authentic paper overlay blending
      ctx.lineWidth = stroke.width;
      // Inject transparency into highlighter if not already present
      ctx.strokeStyle = stroke.color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.color;
    }

    ctx.beginPath();
    
    // De-normalize coordinates back to current canvas dimensions
    const scalePoint = (p: TrackPoint) => ({
      x: p.x * width,
      y: p.y * height,
    });

    const firstPoint = scalePoint(stroke.points[0]);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    if (stroke.points.length === 1) {
      ctx.lineTo(firstPoint.x + 0.1, firstPoint.y);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        // Curve smoothing using quadratic curves
        const xc = (scalePoint(stroke.points[i - 1]).x + scalePoint(stroke.points[i]).x) / 2;
        const yc = (scalePoint(stroke.points[i - 1]).y + scalePoint(stroke.points[i]).y) / 2;
        ctx.quadraticCurveTo(scalePoint(stroke.points[i - 1]).x, scalePoint(stroke.points[i - 1]).y, xc, yc);
      }
      const last = scalePoint(stroke.points[stroke.points.length - 1]);
      ctx.lineTo(last.x, last.y);
    }
    
    ctx.stroke();
    ctx.restore();
  };

  // Helper: Get local canvas coordinate from mouse/touch event
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): TrackPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Coordinates relative to bounding rect style layout
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Normalize coordinates strictly [0, 1] relative to current layout size
    return {
      x: Math.max(0, Math.min(1, x / width)),
      y: Math.max(0, Math.min(1, y / height)),
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isPanning) return; // Ignore input in pan mode
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    currentPointsRef.current = [coords];

    // Give visual immediate feedback by drawing mini dots
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = strokeWidth * 2; // eraser is thicker
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = tool === 'highlighter' ? 'multiply' : 'source-over';
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = color;
        }
        ctx.arc(coords.x * width, coords.y * height, (tool === 'eraser' ? strokeWidth * 2 : strokeWidth) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isPanning) return;
    
    // Prevent standard swipe-refreshing and body-scroll gestures
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    currentPointsRef.current.push(coords);

    // Dynamic real-time stroke preview
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // We redraw the last segment to avoid clearing entire canvas every frame
        const points = currentPointsRef.current;
        if (points.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = strokeWidth * 2; // thicker eraser
            ctx.strokeStyle = 'rgba(0,0,0,1.0)';
          } else if (tool === 'highlighter') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = color;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = color;
          }

          ctx.beginPath();
          const p1 = points[points.length - 2];
          const p2 = points[points.length - 1];
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 0) {
      // Create new DrawingStroke structure
      const newStroke: DrawingStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        points: [...currentPointsRef.current],
        color: color,
        width: tool === 'eraser' ? strokeWidth * 2.2 : strokeWidth, // apply scale compensation for eraser
        type: tool,
      };
      onAddStroke(newStroke);
    }
    currentPointsRef.current = [];
  };

  return (
    <div className="relative group/canvas select-none" style={{ width, height }}>
      {/* Underlying layout wrapper */}
      <canvas
        id="annotation-drawing-canvas-layer"
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{
          width,
          height,
          cursor: isPanning ? 'grab' : tool === 'eraser' ? 'cell' : 'crosshair',
        }}
        className="absolute inset-0 z-20 touch-none block"
      />
    </div>
  );
}
