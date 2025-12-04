
// Constants
export const FIXED_IMG_SIZE = 448;
export const IMAGE_MEAN = 0.9545467;
export const IMAGE_STD = 0.15394445;

/**
 * Trims the white border from an image.
 * @param imageData The image data to trim.
 * @returns The trimmed image data.
 */
export function trimWhiteBorder(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  // Detect background color from corners (like Python implementation)
  const getCornerColor = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  const corners = [
    getCornerColor(0, 0),           // top-left
    getCornerColor(width - 1, 0),   // top-right
    getCornerColor(0, height - 1),  // bottom-left
    getCornerColor(width - 1, height - 1), // bottom-right
  ];

  // Find most common corner color as background
  const bgColor = corners[0]; // Simple: just use top-left as bg color

  // Use threshold of 15 (matching Python implementation)
  const threshold = 15;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Check if pixel differs from background by more than threshold
      if (Math.abs(r - bgColor[0]) > threshold ||
        Math.abs(g - bgColor[1]) > threshold ||
        Math.abs(b - bgColor[2]) > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return imageData; // Return original if empty

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageData;

  // Draw the cropped region
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return imageData;
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, minX, minY, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Resizes and pads an image to a target size.
 * @param imageData The image data to resize and pad.
 * @param targetSize The target size (width and height).
 * @returns A canvas element containing the resized and padded image.
 */
export function resizeAndPad(imageData: ImageData, targetSize: number): HTMLCanvasElement {
  const { width, height } = imageData;

  // Python logic: v2.Resize(size=447, max_size=448)
  // scale1 = 447 / min(w, h)
  // scale2 = 448 / max(w, h)
  // scale = min(scale1, scale2)

  const scale1 = (targetSize - 1) / Math.min(width, height);
  const scale2 = targetSize / Math.max(width, height);
  const scale = Math.min(scale1, scale2);

  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Fill with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Draw resized image at top-left (0, 0)
  // This matches the Python implementation: padding=[0, 0, right, bottom]
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx!.putImageData(imageData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, newW, newH);

  return canvas;
}
