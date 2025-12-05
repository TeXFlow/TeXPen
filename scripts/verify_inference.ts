import { JSDOM } from 'jsdom';
import { inferenceService } from '../services/inference/InferenceService';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';

// Mock Browser Environment
const dom = new JSDOM('<!DOCTYPE html>');
global.document = dom.window.document;
global.window = dom.window as any;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.ImageData = dom.window.ImageData;

// Properly mock document.createElement to return @napi-rs/canvas canvases
const originalCreateElement = global.document.createElement.bind(global.document);
global.document.createElement = (tagName: string, options?: any) => {
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
};

// Mock createImageBitmap to return an object compatible with canvas.drawImage
global.createImageBitmap = async (blob: any): Promise<ImageBitmap> => {
  const buffer = Buffer.from(await (blob as Blob).arrayBuffer());
  const img = await loadImage(buffer);

  console.log(`[DEBUG] Loaded image: ${img.width}x${img.height}`);

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
    console.log(`[DEBUG] drawImage with _image: ${image._image.width}x${image._image.height}`);
    return originalDrawImage.call(this, image._image, ...args);
  }
  return originalDrawImage.call(this, image, ...args);
};

async function runTest() {
  const imagePath = path.resolve(__dirname, '../public/test.png');
  console.log(`Testing with image: ${imagePath}`);

  if (!fs.existsSync(imagePath)) {
    console.error('Test image not found!');
    process.exit(1);
  }

  const buffer = fs.readFileSync(imagePath);
  const blob = new Blob([buffer], { type: 'image/png' });

  console.log('Initializing model...');
  // Use 'cpu' for Node environment (wasm is only for browser, dml for DirectML GPU)
  await inferenceService.init((status) => console.log(status), { device: 'cpu' as any, dtype: 'fp32' });

  console.log('Running inference...');
  try {
    const result = await inferenceService.infer(blob);

    // Save debug image to file for inspection
    if (result.debugImage) {
      const debugBase64 = result.debugImage.replace(/^data:image\/png;base64,/, '');
      const debugBuffer = Buffer.from(debugBase64, 'base64');
      const debugPath = path.resolve(__dirname, '../debug_preprocessed.png');
      fs.writeFileSync(debugPath, debugBuffer);
      console.log(`[DEBUG] Saved preprocessed image to: ${debugPath}`);
    }

    console.log('\n--- Result ---');
    console.log('LaTeX:', result.latex);
    console.log('Candidates:', result.candidates);
    console.log('--------------\n');

    const expected = String.raw`\[
\begin{split}
A&=\frac{\pi r^{2}}{2}\\
&=\frac{1}{2}\pi r^{2}
\end{split}
\qquad\qquad\qquad\qquad \qquad\qquad\qquad\text{(1)}\]`;

    // Simple normalization for comparison (ignore whitespace differences)
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

    if (normalize(result.latex) === normalize(expected)) {
      console.log('✅ Test PASSED!');
    } else {
      console.log('❌ Test FAILED!');
      console.log('Expected:');
      console.log(expected);
    }

  } catch (error) {
    console.error('Inference failed:', error);
  } finally {
    console.log('Cleaning up...');
    await inferenceService.dispose();
    console.log('Done.');
  }
}

runTest();
