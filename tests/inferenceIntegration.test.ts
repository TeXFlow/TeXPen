import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import { inferenceService } from '../services/inference/InferenceService';

// Setup Mock Browser Environment
const dom = new JSDOM('<!DOCTYPE html>');
global.document = dom.window.document as any;
global.window = dom.window as any;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.ImageData = dom.window.ImageData;

// Properly mock document.createElement to return @napi-rs/canvas canvases
const originalCreateElement = global.document.createElement.bind(global.document);
global.document.createElement = ((tagName: string, options?: any) => {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = createCanvas(1, 1) as any;
    // Ensure toDataURL returns proper format
    const originalToDataURL = canvas.toDataURL.bind(canvas);
    canvas.toDataURL = (type?: string, quality?: number) => {
      return originalToDataURL(type || 'image/png');
    };
    return canvas;
  }
  return originalCreateElement(tagName, options);
}) as any;

// Mock createImageBitmap to return an object compatible with canvas.drawImage
global.createImageBitmap = async (blob: any): Promise<ImageBitmap> => {
  const buffer = Buffer.from(await (blob as Blob).arrayBuffer());
  const img = await loadImage(buffer);

  // Return an object that looks like ImageBitmap but works with @napi-rs/canvas
  return {
    width: img.width,
    height: img.height,
    close: () => { },
    // Store the actual image for drawImage to use
    _image: img,
  } as any;
};

// Monkey-patch the canvas context's drawImage to handle our mock ImageBitmap
const CanvasRenderingContext2DPrototype = (createCanvas(1, 1).getContext('2d') as any).__proto__;
const originalDrawImage = CanvasRenderingContext2DPrototype.drawImage;
CanvasRenderingContext2DPrototype.drawImage = function (image: any, ...args: any[]) {
  // If it's our mock ImageBitmap, use the stored _image
  if (image && image._image) {
    return originalDrawImage.call(this, image._image, ...args);
  }
  return originalDrawImage.call(this, image, ...args);
};

describe('InferenceService Integration', () => {
  // Increase timeout significantly for model downloading/loading
  // 60 seconds might be enough if cached, otherwise it might take longer.
  // Since this is a test, we hopefully have it cached or we accept it takes time.
  it('should run end-to-end inference on test image', async () => {
    const imagePath = path.resolve(__dirname, '../public/assets/test.png');

    if (!fs.existsSync(imagePath)) {
      console.warn('Test image not found, skipping integration test');
      return;
    }

    const buffer = fs.readFileSync(imagePath);
    const blob = new Blob([buffer], { type: 'image/png' });

    // Initialize model
    try {
      await inferenceService.init((status) => console.log(status), { device: 'cpu' as any, dtype: 'fp32' });

      // Run inference
      const result = await inferenceService.infer(blob);

      expect(result).toBeDefined();
      expect(result.latex).toBeDefined();
      expect(result.candidates.length).toBeGreaterThan(0);

      const expected = String.raw`\[
  \begin{split}
  A&=\frac{\pi r^{2}}{2}\\
  &=\frac{1}{2}\pi r^{2}
  \end{split}
  \qquad\qquad\qquad\qquad \qquad\qquad\qquad(1)\]`;

      // Simple normalization for comparison
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

      // We use a loose check or exact check depending on determinism.
      // For integration, just ensuring it produces *something* close or valid is good.
      // But verifying exact output is better if deterministic.
      // NOTE: Commenting out strict check if causing transform issues, but let's try with strict check again.
      expect(normalize(result.latex)).toBe(normalize(expected));
    } catch (e) {
      console.error('Integration test failed:', e);
      throw e;
    }

  }, 120000); // 2 minute timeout

  afterAll(async () => {
    await inferenceService.dispose();
  });
});
