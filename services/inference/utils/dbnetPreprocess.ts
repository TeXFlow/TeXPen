
import { Tensor } from 'onnxruntime-web';

// ImageNet Stats
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/**
 * Preprocess for DBNet.
 * Resize to target size (keeping aspect ratio, padding if needed, or simple resize?)
 * DBNet usually handles dynamic input, but must be multiple of 32.
 * TexTeller implementation typically resizes the long side to a target (e.g. 960) and preserves aspect ratio,
 * ensuring dimensions are multiples of 32.
 */
export async function preprocessDBNet(
  imageBlob: Blob,
  limitSize: number = 960
): Promise<{ tensor: Tensor; inputWidth: number; inputHeight: number; originalWidth: number; originalHeight: number }> {
  const bitmap = await createImageBitmap(imageBlob);
  const { width: w, height: h } = bitmap;

  // Calculate new size
  // Resize logic: limit max dimension to limitSize, ensuring multiple of 32
  let newW = w;
  let newH = h;
  const maxDim = Math.max(w, h);

  if (maxDim > limitSize) {
    const scale = limitSize / maxDim;
    newW = Math.round(w * scale);
    newH = Math.round(h * scale);
  }

  // Ensure multiple of 32
  newW = Math.round(newW / 32) * 32;
  newH = Math.round(newH / 32) * 32;

  // Create canvas
  const canvas = new OffscreenCanvas(newW, newH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Context failed");

  ctx.drawImage(bitmap, 0, 0, newW, newH);

  const imageData = ctx.getImageData(0, 0, newW, newH);
  const { data } = imageData;
  const floatData = new Float32Array(3 * newW * newH);

  // Normalize
  for (let i = 0; i < newW * newH; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // RGB layout in output
    floatData[i] = (r - MEAN[0]) / STD[0];
    floatData[newW * newH + i] = (g - MEAN[1]) / STD[1];
    floatData[2 * newW * newH + i] = (b - MEAN[2]) / STD[2];
  }

  const tensor = new Tensor('float32', floatData, [1, 3, newH, newW]);

  return {
    tensor,
    inputWidth: newW,
    inputHeight: newH,
    originalWidth: w,
    originalHeight: h
  };
}
