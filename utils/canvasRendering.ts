import { Point, Stroke } from '../types/canvas';

/**
 * Draw a single stroke on the canvas context
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  theme: 'dark' | 'light'
): void {
  if (stroke.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.width || 3;
  ctx.strokeStyle = stroke.color || (theme === 'dark' ? '#ffffff' : '#000000');
  ctx.stroke();
}

/**
 * Draw all strokes on the canvas
 */
export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  theme: 'dark' | 'light'
): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';

  strokes.forEach(stroke => {
    drawStroke(ctx, stroke, theme);
  });
}

/**
 * Calculate bounding box for selected strokes
 */
export function getSelectionBounds(
  strokes: Stroke[],
  indices: number[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  indices.forEach(index => {
    const stroke = strokes[index];
    if (stroke) {
      stroke.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    }
  });

  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Draw selection highlight around selected strokes
 */
export function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  selectedIndices: number[],
  padding: number = 5
): void {
  const bounds = getSelectionBounds(strokes, selectedIndices);
  if (!bounds) return;

  ctx.save();
  ctx.strokeStyle = '#3b82f6'; // Blue color for selection
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(
    bounds.minX - padding,
    bounds.minY - padding,
    (bounds.maxX - bounds.minX) + padding * 2,
    (bounds.maxY - bounds.minY) + padding * 2
  );
  ctx.restore();
}

/**
 * Draw a selection box (rectangular selection area)
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  start: Point,
  current: Point
): void {
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.lineWidth = 1;

  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x);
  const h = Math.abs(current.y - start.y);

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/**
 * Copy content from one canvas to another
 */
export function copyToCanvas(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement
): void {
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.resetTransform();
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}
