
import { BBox } from '../types';

/**
 * Basic NMS implementation.
 * @param boxes Array of boxes [x, y, w, h] with combined confidence in label or separate
 * @param scores Array of confidence scores corresponding to boxes
 * @param iouThreshold Intersection over Union threshold
 */
export function nonMaxSuppression(
  boxes: BBox[],
  iouThreshold: number
): BBox[] {
  // Sort by confidence (descending)
  const sorted = [...boxes].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const results: BBox[] = [];

  while (sorted.length > 0) {
    const current = sorted.shift()!;
    results.push(current);

    // Filter out boxes with high IOU
    for (let i = sorted.length - 1; i >= 0; i--) {
      const other = sorted[i];
      if (computeIOU(current, other) > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }

  return results;
}

function computeIOU(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersectionW = Math.max(0, x2 - x1);
  const intersectionH = Math.max(0, y2 - y1);
  const intersectionArea = intersectionW * intersectionH;

  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const unionArea = areaA + areaB - intersectionArea;

  if (unionArea === 0) return 0;
  return intersectionArea / unionArea;
}

/**
 * Post-processes YOLO output.
 * Assumes output shape [1, 5, 8400] or similar (batch, [xc, yc, w, h, conf], anchors)
 * Adjust logic based on specific model export (sometimes permuted).
 */
export function yoloPostprocess(
  output: Float32Array,
  dims: number[],
  confThreshold: number,
  originalWidth: number,
  originalHeight: number,
  inputWidth: number, // Model input size
  inputHeight: number
): BBox[] {
  // Check dims. Usually [1, 5, N] or [1, N, 5]
  // Common YOLOv8 export: [1, 5, 8400] -> 5 channels: cx, cy, w, h, score (class 0)

  // Flattened array access
  const numChannels = dims[1]; // e.g. 5 (4 bbox + 1 conf) or more if multi-class
  const numAnchors = dims[2]; // e.g. 8400

  const boxes: BBox[] = [];

  // Scaling factors
  const scaleX = originalWidth / inputWidth;
  const scaleY = originalHeight / inputHeight;

  // Loop through anchors
  for (let i = 0; i < numAnchors; i++) {
    // Access column i
    // Data layout: [ [cx...], [cy...], [w...], [h...], [conf...] ]
    // Index = channel * numAnchors + i

    // Assuming structure [1, C, N]
    const off = 0; // Batch 0 offset

    const score = output[4 * numAnchors + i]; // 5th row (index 4)

    if (score > confThreshold) {
      const cx = output[0 * numAnchors + i];
      const cy = output[1 * numAnchors + i];
      const w = output[2 * numAnchors + i];
      const h = output[3 * numAnchors + i];

      // Convert center-wh to top-left-wh
      const x = (cx - w / 2) * scaleX;
      const y = (cy - h / 2) * scaleY;
      const width = w * scaleX;
      const height = h * scaleY;

      boxes.push({
        x,
        y,
        w: width,
        h: height,
        confidence: score,
        label: 'latex' // Todo: handle multi-class if needed
      });
    }
  }

  return nonMaxSuppression(boxes, 0.45); // Standard IOU threshold
}
