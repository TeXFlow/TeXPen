import { RawImage } from "@huggingface/transformers";

export const FIXED_IMG_SIZE = 448;

/**
 * Trims the white border from an image (Canvas).
 * Replicates `trim_white_border` from TexTeller's image.py.
 */
export function trimWhiteBorder(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Find bounds
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  // Simple thresholding to find non-white pixels
  // Assuming white background (255, 255, 255)
  // We can use a tolerance
  const threshold = 240;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Check if pixel is NOT white (and not transparent)
      if (a > 0 && (r < threshold || g < threshold || b < threshold)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) {
    // Return original if empty
    return canvas;
  }

  // Add a small padding like the python script might implicitly do or just crop exactly?
  // Python script uses cv2.boundingRect on a thresholded diff.
  // We'll just crop to the bounding box.
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = cropWidth;
  trimmedCanvas.height = cropHeight;
  const trimmedCtx = trimmedCanvas.width > 0 && trimmedCanvas.height > 0
    ? trimmedCanvas.getContext('2d', { willReadFrequently: true })
    : null;
  if (!trimmedCtx) return canvas;

  trimmedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return trimmedCanvas;
}

/**
 * Resizes and pads the image to the fixed size (448x448).
 * Replicates `transform` pipeline (Resize + Pad).
 */
export function resizeAndPad(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const targetSize = FIXED_IMG_SIZE;
  const width = canvas.width;
  const height = canvas.height;

  // Calculate scale to fit within targetSize x targetSize
  // Python: v2.Resize(size=FIXED_IMG_SIZE - 1, max_size=FIXED_IMG_SIZE, ...)
  // It seems it resizes the smaller edge to size, but max_size limits the larger edge?
  // Wait, `v2.Resize(size=447, max_size=448)`:
  // "If size is an int, smaller edge of the image will be matched to this number.
  //  i.e., if height > width, then image will be rescaled to (size * height / width, size).
  //  ... unless max_size is given, in which case the maximum size of the image is enforced."

  // Let's stick to a safe "contain" resize logic:
  // Scale down so the largest dimension is at most targetSize (or targetSize - 1).

  const scale = Math.min((targetSize - 1) / width, (targetSize - 1) / height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const paddedCanvas = document.createElement('canvas');
  paddedCanvas.width = targetSize;
  paddedCanvas.height = targetSize;
  const ctx = paddedCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  // Fill with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Center the image? Or top-left?
  // Python `padding` function: `v2.functional.pad(img, padding=[0, 0, required_size - img.shape[2], required_size - img.shape[1]])`
  // This looks like it pads to the right and bottom! (Left, Top, Right, Bottom) -> [0, 0, diffW, diffH]
  // So we draw at 0, 0.

  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

  return paddedCanvas;
}

export async function canvasToRawImage(canvas: HTMLCanvasElement): Promise<RawImage> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error("Failed to convert canvas to blob");
  return await RawImage.fromBlob(blob);
}
