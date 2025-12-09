import { describe, it, expect, beforeAll } from 'vitest';
import { pipeline, env, RawImage } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

// Configure transformers.js to use local cache and node-compatible settings
// Doing this at the top level to ensure it applies before any pipeline calls
env.allowLocalModels = false;
env.useBrowserCache = false;

describe('Transformers Pipeline', () => {
  it('should run image-to-text pipeline on test image', async () => {
    const imagePath = path.resolve(__dirname, '../public/assets/test.png');

    if (!fs.existsSync(imagePath)) {
      console.warn('Test image not found, skipping pipeline test');
      return;
    }

    // Initialize pipeline
    // Using the same model and settings as the original script
    try {
      const pipe = await pipeline('image-to-text', 'onnx-community/TexTeller3-ONNX', {
        device: 'cpu',
        dtype: 'fp32',
      });

      // Load image and convert to grayscale as expected by the model
      const image = await RawImage.read(imagePath);
      const grayscale = image.grayscale();

      // Run inference
      const result = await pipe(grayscale, {
        max_new_tokens: 1024,
        num_beams: 1,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('generated_text');
    } catch (e) {
      console.error('Pipeline failed:', e);
      throw e;
    }

    // Optional: Log the result to see what it produced, similar to the script
    // console.log('Pipeline Result:', JSON.stringify(result, null, 2));

  }, 120000); // 2 minute timeout for model loading
});
