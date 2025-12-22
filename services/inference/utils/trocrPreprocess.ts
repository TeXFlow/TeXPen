
import { Tensor } from '@huggingface/transformers';

const MEAN = [0.5, 0.5, 0.5]; // TrOCR default mean (often 0.5 for ViT, check specific model) 
// HuggingFace TrOCR default: 0.5, 0.5, 0.5 per processor config usually.
// Or ImageNet [0.485, 0.456, 0.406].
// Let's use ImageNet as it's most common for ViT backbones if not specified.
// Actually Microsoft/TrOCR uses [0.5, 0.5, 0.5] and std [0.5, 0.5, 0.5].
const STD = [0.5, 0.5, 0.5];

export async function preprocessTrOCR(
  imageBlob: Blob,
  targetW: number = 384,
  targetH: number = 384
): Promise<Tensor> {
  const bitmap = await createImageBitmap(imageBlob);
  const { width: w, height: h } = bitmap;

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Context failed");

  // Resize (distorted or preserved?)
  // TrOCR usually expects resized image to 384x384. 
  // It handles text lines effectively. Standard pipeline often resizes directly.
  ctx.drawImage(bitmap, 0, 0, targetW, targetH); // Distort to square

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const { data } = imageData;
  const floatData = new Float32Array(3 * targetW * targetH);

  for (let i = 0; i < targetW * targetH; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    floatData[i] = (r - MEAN[0]) / STD[0];
    floatData[targetW * targetH + i] = (g - MEAN[1]) / STD[1];
    floatData[2 * targetW * targetH + i] = (b - MEAN[2]) / STD[2];
  }

  return new Tensor('float32', floatData, [1, 3, targetH, targetW]);
}
